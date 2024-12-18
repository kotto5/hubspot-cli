// @ts-nocheck
const { accountNameExistsInConfig } = require('@hubspot/local-dev-lib/config');
const { promptUser } = require('./promptUtils');
const { i18n } = require('../lang');
const {
  HUBSPOT_ACCOUNT_TYPES,
} = require('@hubspot/local-dev-lib/constants/config');

const i18nKey = 'lib.prompts.accountNamePrompt';

const getCliAccountNamePromptConfig = defaultName => ({
  name: 'name',
  message: i18n(`${i18nKey}.enterAccountName`),
  default: defaultName,
  validate(val) {
    if (typeof val !== 'string') {
      return i18n(`${i18nKey}.errors.invalidName`);
    } else if (!val.length) {
      return i18n(`${i18nKey}.errors.nameRequired`);
    } else if (val.indexOf(' ') >= 0) {
      return i18n(`${i18nKey}.errors.spacesInName`);
    }
    return accountNameExistsInConfig(val)
      ? i18n(`${i18nKey}.errors.accountNameExists`, { name: val })
      : true;
  },
});

const cliAccountNamePrompt = defaultName => {
  return promptUser(getCliAccountNamePromptConfig(defaultName));
};

const hubspotAccountNamePrompt = ({ accountType, currentPortalCount = 0 }) => {
  const isDevelopmentSandbox =
    accountType === HUBSPOT_ACCOUNT_TYPES.DEVELOPMENT_SANDBOX;
  const isSandbox =
    accountType === HUBSPOT_ACCOUNT_TYPES.STANDARD_SANDBOX ||
    isDevelopmentSandbox;
  const isDeveloperTestAccount =
    accountType === HUBSPOT_ACCOUNT_TYPES.DEVELOPER_TEST;

  let promptMessageString;
  let defaultName;
  if (isSandbox) {
    promptMessageString = isDevelopmentSandbox
      ? i18n(`${i18nKey}.enterDevelopmentSandboxName`)
      : i18n(`${i18nKey}.enterStandardSandboxName`);
  } else if (isDeveloperTestAccount) {
    promptMessageString = i18n(`${i18nKey}.enterDeveloperTestAccountName`);
    defaultName = i18n(`${i18nKey}.developerTestAccountDefaultName`, {
      count: currentPortalCount + 1,
    });
  }

  return promptUser([
    {
      name: 'name',
      message: promptMessageString,
      validate(val) {
        if (typeof val !== 'string') {
          return i18n(`${i18nKey}.errors.invalidName`);
        } else if (!val.trim().length) {
          return i18n(`${i18nKey}.errors.nameRequired`);
        }
        return accountNameExistsInConfig(val)
          ? i18n(`${i18nKey}.errors.accountNameExists`, { name: val })
          : true;
      },
      default: defaultName,
    },
  ]);
};

module.exports = {
  getCliAccountNamePromptConfig,
  cliAccountNamePrompt,
  hubspotAccountNamePrompt,
};
