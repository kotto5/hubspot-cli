const ora = require('ora');
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
} = require('../../lib/errorHandlers/apiErrors');

const { poll } = require('../../lib/polling');
const { logger } = require('@hubspot/local-dev-lib/logger');
const {
  buildPackage,
  getBuildStatus,
} = require('@hubspot/local-dev-lib/api/functions');
const { loadAndValidateOptions } = require('../../lib/validation');
const { outputBuildLog } = require('../../lib/serverlessLogs');
const { i18n } = require('../../lib/lang');

const i18nKey = 'commands.functions.subcommands.deploy';

exports.command = 'deploy <path>';
exports.describe = false;

exports.handler = async options => {
  await loadAndValidateOptions(options);

  const { path: functionPath } = options;
  const accountId = getAccountId(options);
  const splitFunctionPath = functionPath.split('.');
  let spinner;

  trackCommandUsage('functions-deploy', null, accountId);

  if (
    !splitFunctionPath.length ||
    splitFunctionPath[splitFunctionPath.length - 1] !== 'functions'
  ) {
    logger.error(
      i18n(`${i18nKey}.errors.notFunctionsFolder`, {
        functionPath,
      })
    );
    return;
  }

  logger.debug(
    i18n(`${i18nKey}.debug.startingBuildAndDeploy`, {
      functionPath,
    })
  );

  try {
    spinner = ora(
      i18n(`${i18nKey}.loading`, {
        accountId,
        functionPath,
      })
    ).start();
    const buildId = await buildPackage(accountId, functionPath);
    const successResp = await poll(getBuildStatus, accountId, buildId);
    const buildTimeSeconds = (successResp.buildTime / 1000).toFixed(2);
    spinner.stop();
    await outputBuildLog(successResp.cdnUrl);
    logger.success(
      i18n(`${i18nKey}.success.deployed`, {
        accountId,
        buildTimeSeconds,
        functionPath,
      })
    );
  } catch (e) {
    spinner && spinner.stop && spinner.stop();
    if (e.statusCode === 404) {
      logger.error(
        i18n(`${i18nKey}.errors.noPackageJson`, {
          functionPath,
        })
      );
    } else if (e.statusCode === 400) {
      logger.error(e.error.message);
    } else if (e.status === 'ERROR') {
      await outputBuildLog(e.cdnUrl);
      logger.error(
        i18n(`${i18nKey}.errors.buildError`, {
          details: e.errorReason,
        })
      );
    } else {
      logApiErrorInstance(
        e,
        new ApiErrorContext({ accountId, request: functionPath })
      );
    }
  }
};

exports.builder = yargs => {
  yargs.positional('path', {
    describe: i18n(`${i18nKey}.positionals.path.describe`),
    type: 'string',
  });

  yargs.example([
    [
      '$0 functions deploy myFunctionFolder.functions',
      i18n(`${i18nKey}.examples.default`),
    ],
  ]);

  addConfigOptions(yargs);
  addAccountOptions(yargs);
  addUseEnvironmentOptions(yargs);

  return yargs;
};
