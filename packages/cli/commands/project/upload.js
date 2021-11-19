const chalk = require('chalk');
const fs = require('fs');
const path = require('path');
const archiver = require('archiver');
const tmp = require('tmp');
const Spinnies = require('spinnies');
const {
  addAccountOptions,
  addConfigOptions,
  getAccountId,
  addUseEnvironmentOptions,
} = require('../../lib/commonOpts');
const { trackCommandUsage } = require('../../lib/usageTracking');
const {
  logApiErrorInstance,
  ApiErrorContext,
} = require('@hubspot/cli-lib/errorHandlers');
const { getAccountDescription } = require('../../lib/ui');
const { logger } = require('@hubspot/cli-lib/logger');
const { uploadProject } = require('@hubspot/cli-lib/api/dfs');
const { shouldIgnoreFile } = require('@hubspot/cli-lib/ignoreRules');
const { loadAndValidateOptions } = require('../../lib/validation');
const {
  getProjectConfig,
  validateProjectConfig,
  pollBuildStatus,
  ensureProjectExists,
  pollDeployStatus,
} = require('../../lib/projects');
const { EXIT_CODES } = require('../../lib/exitCodes');

exports.command = 'upload [path]';
exports.describe = false;

const uploadProjectFiles = async (accountId, projectName, filePath) => {
  const spinnies = new Spinnies({
    succeedColor: 'white',
  });

  spinnies.add('upload', {
    text: `Uploading ${chalk.bold(
      projectName
    )} project files to ${getAccountDescription(accountId)}`,
  });

  let buildId;

  try {
    const upload = await uploadProject(accountId, projectName, filePath);

    buildId = upload.buildId;

    spinnies.succeed('upload', {
      text: `Uploaded ${chalk.bold(
        projectName
      )} project files to ${getAccountDescription(accountId)}`,
    });

    logger.debug(
      `Project "${projectName}" uploaded and build #${buildId} created`
    );
  } catch (err) {
    spinnies.fail('upload', {
      text: `Failed to upload ${chalk.bold(
        projectName
      )} project files to ${getAccountDescription(accountId)}`,
    });

    logApiErrorInstance(
      err,
      new ApiErrorContext({
        accountId,
        projectName,
      })
    );
    process.exit(EXIT_CODES.ERROR);
  }

  return { buildId };
};

exports.handler = async options => {
  await loadAndValidateOptions(options);

  const { forceCreate, path: projectPath } = options;
  const accountId = getAccountId(options);

  trackCommandUsage('project-upload', { projectPath }, accountId);

  const { projectConfig, projectDir } = await getProjectConfig(projectPath);

  validateProjectConfig(projectConfig, projectDir);

  await ensureProjectExists(accountId, projectConfig.name, forceCreate);

  const tempFile = tmp.fileSync({ postfix: '.zip' });

  logger.debug(`Compressing build files to '${tempFile.name}'`);

  const output = fs.createWriteStream(tempFile.name);
  const archive = archiver('zip');

  output.on('close', async function() {
    let exitCode = EXIT_CODES.SUCCESS;
    logger.debug(`Project files compressed: ${archive.pointer()} bytes`);

    const { buildId } = await uploadProjectFiles(
      accountId,
      projectConfig.name,
      tempFile.name
    );

    const {
      isAutoDeployEnabled,
      deployStatusTaskLocator,
      status,
      subbuildStatuses,
    } = await pollBuildStatus(accountId, projectConfig.name, buildId);

    if (status === 'FAILURE') {
      const failedSubbuilds = subbuildStatuses.filter(
        subbuild => subbuild.status === 'FAILURE'
      );

      logger.log('-'.repeat(50));
      logger.log(
        `Build #${buildId} failed because there was a problem\nbuilding ${
          failedSubbuilds.length === 1
            ? failedSubbuilds[0].buildName
            : failedSubbuilds.length + ' components'
        }\n`
      );
      logger.log('See below for a summary of errors.');
      logger.log('-'.repeat(50));

      failedSubbuilds.forEach(subbuild => {
        logger.log(
          `\n--- ${subbuild.buildName} failed to build with the following error ---`
        );
        logger.error(subbuild.errorMessage);
      });

      exitCode = EXIT_CODES.ERROR;
    } else if (isAutoDeployEnabled && deployStatusTaskLocator) {
      logger.log(
        `Build #${buildId} succeeded. ${chalk.bold(
          'Automatically deploying'
        )} to ${getAccountDescription(accountId)}`
      );
      const { status } = await pollDeployStatus(
        accountId,
        projectConfig.name,
        deployStatusTaskLocator.id,
        buildId
      );
      if (status === 'FAILURE') {
        exitCode = EXIT_CODES.ERROR;
      }
    } else {
      logger.log('-'.repeat(50));
      logger.log(chalk.bold(`Build #${buildId} succeeded\n`));
      logger.log('🚀 Ready to take your project live?');
      logger.log(`Run \`${chalk.hex('f5c26b')('hs project deploy')}\``);
      logger.log('-'.repeat(50));
    }

    try {
      tempFile.removeCallback();
      logger.debug(`Cleaned up temporary file ${tempFile.name}`);
    } catch (e) {
      logger.error(e);
    }

    process.exit(exitCode);
  });

  archive.on('error', function(err) {
    throw err;
  });

  archive.pipe(output);

  archive.directory(
    path.resolve(projectDir, projectConfig.srcDir),
    false,
    file => (shouldIgnoreFile(file.name) ? false : file)
  );

  archive.finalize();
};

exports.builder = yargs => {
  yargs.positional('path', {
    describe: 'Path to a project folder',
    type: 'string',
  });

  yargs.option('forceCreate', {
    describe: 'Automatically create project if it does not exist',
    type: 'boolean',
    default: false,
  });

  yargs.example([['$0 project upload myProjectFolder', 'Upload a project']]);

  addConfigOptions(yargs, true);
  addAccountOptions(yargs, true);
  addUseEnvironmentOptions(yargs, true);

  return yargs;
};
