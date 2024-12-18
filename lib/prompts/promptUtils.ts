const inquirer = require('inquirer');

// NOTE: we can eventually delete this and directly use inquirer.prompt when the files support imports
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const promptUser: any = inquirer.createPromptModule();

export async function confirmPrompt(
  message: string,
  options: { defaultAnswer?: boolean; when?: boolean | (() => boolean) } = {}
): Promise<boolean> {
  const { defaultAnswer, when } = options;
  const { choice } = await promptUser([
    {
      name: 'choice',
      type: 'confirm',
      message,
      default: defaultAnswer || true,
      when,
    },
  ]);
  return choice;
}

export async function listPrompt(
  message: string,
  {
    choices,
    when,
  }: {
    choices: Array<{ name: string; value: string }>;
    when?: boolean | (() => boolean);
  }
): Promise<string> {
  const { choice } = await promptUser([
    {
      name: 'choice',
      type: 'list',
      message,
      choices,
      when,
    },
  ]);
  return choice;
}
