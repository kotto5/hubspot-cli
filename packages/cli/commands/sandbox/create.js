const {
  addAccountOptions,
  addConfigOptions,
  getAccountId,
  addUseEnvironmentOptions,
  addTestingOptions,
} = require('../../lib/commonOpts');
const { loadAndValidateOptions } = require('../../lib/validation');
const { i18n } = require('@hubspot/cli-lib/lib/lang');
const { EXIT_CODES } = require('../../lib/enums/exitCodes');
const { getAccountConfig, getEnv } = require('@hubspot/cli-lib');
const { buildSandbox } = require('../../lib/sandbox-create');
const { uiFeatureHighlight } = require('../../lib/ui');
const { sandboxTypeMap, DEVELOPER_SANDBOX } = require('../../lib/sandboxes');
const { getValidEnv } = require('@hubspot/cli-lib/lib/environment');

const i18nKey = 'cli.commands.sandbox.subcommands.create';

exports.command = 'create [--name] [--type]';
exports.describe = i18n(`${i18nKey}.describe`);

exports.handler = async options => {
  await loadAndValidateOptions(options);

  const { name, type, force } = options;
  const accountId = getAccountId(options);
  const accountConfig = getAccountConfig(accountId);
  const env = getValidEnv(getEnv(accountId));

  try {
    const { result } = await buildSandbox({
      name,
      type,
      accountConfig,
      env,
      force,
    });

    const sandboxType = sandboxTypeMap[result.sandbox.type];
    uiFeatureHighlight([
      // 'projectDevCommand',
      'projectUploadCommand',
      sandboxType === DEVELOPER_SANDBOX
        ? 'sandboxSyncDevelopmentCommand'
        : 'sandboxSyncStandardCommand',
    ]);
    process.exit(EXIT_CODES.SUCCESS);
  } catch (error) {
    // Errors are logged in buildSandbox
    process.exit(EXIT_CODES.ERROR);
  }
};

exports.builder = yargs => {
  yargs.option('f', {
    type: 'boolean',
    alias: 'force',
    describe: i18n(`${i18nKey}.examples.force`),
  });
  yargs.option('name', {
    describe: i18n(`${i18nKey}.options.name.describe`),
    type: 'string',
  });
  yargs.option('type', {
    describe: i18n(`${i18nKey}.options.type.describe`),
    type: 'string',
  });

  yargs.example([
    [
      '$0 sandbox create --name=MySandboxAccount --type=STANDARD',
      i18n(`${i18nKey}.examples.default`),
    ],
  ]);

  addConfigOptions(yargs, true);
  addAccountOptions(yargs, true);
  addUseEnvironmentOptions(yargs, true);
  addTestingOptions(yargs, true);

  return yargs;
};
