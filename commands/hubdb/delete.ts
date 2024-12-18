// @ts-nocheck
const { logger } = require('@hubspot/local-dev-lib/logger');
const { logError } = require('../../lib/errorHandlers/index');
const { deleteTable } = require('@hubspot/local-dev-lib/api/hubdb');
const { loadAndValidateOptions } = require('../../lib/validation');
const { trackCommandUsage } = require('../../lib/usageTracking');

const {
  addConfigOptions,
  addAccountOptions,
  addUseEnvironmentOptions,
  getAccountId,
} = require('../../lib/commonOpts');
const { i18n } = require('../../lib/lang');

const i18nKey = 'commands.hubdb.subcommands.delete';

exports.command = 'delete <tableId>';
exports.describe = i18n(`${i18nKey}.describe`);

exports.handler = async options => {
  const { tableId } = options;

  await loadAndValidateOptions(options);

  const accountId = getAccountId(options);

  trackCommandUsage('hubdb-delete', null, accountId);

  try {
    await deleteTable(accountId, tableId);
    logger.success(
      i18n(`${i18nKey}.success.delete`, {
        accountId,
        tableId,
      })
    );
  } catch (e) {
    logger.error(
      i18n(`${i18nKey}.errors.delete`, {
        tableId,
      })
    );
    logError(e);
  }
};

exports.builder = yargs => {
  addAccountOptions(yargs);
  addConfigOptions(yargs);
  addUseEnvironmentOptions(yargs);

  yargs.positional('tableId', {
    describe: i18n(`${i18nKey}.positionals.tableId.describe`),
    type: 'string',
  });
};
