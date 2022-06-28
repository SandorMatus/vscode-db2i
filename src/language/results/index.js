const vscode = require(`vscode`);

const csv = require(`csv/sync`);

const getInstance = require(`../../base`);
const html = require(`./html`);

class ResultSetPanelProvider {
  constructor() {
    /** @type {vscode.WebviewView} */
    this._view = undefined;

    this.loadingState = false;
  }

  /**
   * 
   * @param {vscode.WebviewView} webviewView 
   * @param {vscode.WebviewViewResolveContext} context 
   * @param {vscode.CancellationToken} _token 
   */
  resolveWebviewView(webviewView, context, _token) {
    this._view = webviewView;

    webviewView.webview.options = {
      // Allow scripts in the webview
      enableScripts: true,
    };

    webviewView.webview.html = html.getLoadingHTML();
  }

  async focus() {
    if (!this._view) {
      // Weird one. Kind of a hack. _view.show doesn't work yet because it's not initialized.
      // But, we can call a VS Code API to focus on the tab, which then
      // 1. calls resolveWebviewView
      // 2. sets this._view
      await vscode.commands.executeCommand(`vscode-db2i.resultset.focus`);
    }
    
    this._view.show(true);
  }

  async setLoadingText(content) {
    await this.focus();

    if (!this.loadingState) {
      this._view.webview.html = html.getLoadingHTML();
      this.loadingState = true;
    }

    html.setLoadingText(this._view.webview, content);
  }

  /**
   * @param {object[]} results 
   */
  async setResults(results) {
    await this.focus();
    this.loadingState = false;
    const content = html.generateResults(results);
    this._view.webview.html = content;
  }

  async setScrolling(basicSelect) {
    await this.focus();

    this._view.webview.html = html.generateScroller(basicSelect);
    this._view.webview.onDidReceiveMessage(async (message) => {
      if (message.query && message.limit && message.offset >= 0) {
        const instance = await getInstance();
        const content = instance.getContent();
        const config = instance.getConfig();

        const statement = [
          `SET CURRENT SCHEMA = '${config.currentLibrary.toUpperCase()}'`,
          `WITH SCROLLING AS (${message.query}) SELECT * FROM SCROLLING LIMIT ${message.limit} OFFSET ${message.offset}`,
        ].join(`;\n`);

        let data = [];
        try {
          data = await content.runSQL(statement);
        } catch (e) {
          // TODO: nice error?
          data = [];
        }

        this._view.webview.postMessage({
          command: `rows`,
          rows: data,
        });
      }
    });

    // this._view.webview.postMessage({
    //   command: `fetch`
    // });
  }

  setError(error) {
    // TODO: pretty error
    this._view.webview.html = `<p>${error}</p>`;
  }
}

/**
 * @param {vscode.ExtensionContext} context 
 */
exports.initialise = (context) => {
  let resultSetProvider = new ResultSetPanelProvider();

  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider(`vscode-db2i.resultset`, resultSetProvider),

    vscode.commands.registerCommand(`vscode-db2i.runEditorStatement`, async () => {
      const instance = getInstance();
      const config = instance.getConfig();
      const content = instance.getContent();
      const editor = vscode.window.activeTextEditor;

      if (editor.document.languageId === `sql`) {
        const statement = this.parseStatement(editor);

        if (statement.content.trim().length > 0) {
          try {
            if (statement.type === `cl`) {
              const commandResult = await vscode.commands.executeCommand(`code-for-ibmi.runCommand`, {
                command: statement.content,
                environment: `ile`
              });

              if (commandResult.code === 0 || commandResult.code === null) {
                vscode.window.showInformationMessage(`Command executed successfuly.`);
              } else {
                vscode.window.showErrorMessage(`Command failed to run.`);
              }

              let output = ``;
              if (commandResult.stderr.length > 0) output += `${commandResult.stderr}\n\n`;
              if (commandResult.stdout.length > 0) output += `${commandResult.stdout}\n\n`;

              const textDoc = await vscode.workspace.openTextDocument({language: `txt`, content: output});
              await vscode.window.showTextDocument(textDoc, {
                preserveFocus: true,
                preview: true
              });

            } else {

              if (statement.content.toUpperCase().startsWith(`SELECT`) && !statement.content.toUpperCase().includes(`LIMIT`)) {
                resultSetProvider.setScrolling(statement.content);

              } else {
                statement.content = [
                  `SET CURRENT SCHEMA = '${config.currentLibrary.toUpperCase()}'`,
                  statement.content
                ].join(`;\n`);

                if (statement.type === `statement`) {
                  resultSetProvider.setLoadingText(`Executing statement...`);
                }

                const data = await content.runSQL(statement.content);

                if (data.length > 0) {
                  switch (statement.type) {
                  case `statement`:
                    resultSetProvider.setResults(data);
                    break;

                  case `csv`:
                  case `json`:
                  case `sql`:
                    let content = ``;
                    switch (statement.type) {
                    case `csv`: content = csv.stringify(data, {
                      header: true,
                      quoted_string: true,
                    }); break;
                    case `json`: content = JSON.stringify(data, null, 2); break;

                    case `sql`: 
                      const keys = Object.keys(data[0]);

                      const insertStatement = [
                        `insert into TABLE (`,
                        `  ${keys.join(`, `)}`,
                        `) values `,
                        data.map(
                          row => `  (${keys.map(key => {
                            if (row[key] === null) return `null`;
                            if (typeof row[key] === `string`) return `'${row[key].replace(/'/g, `''`)}'`;
                            return row[key];
                          }).join(`, `)})`
                        ).join(`,\n`),
                      ];
                      content = insertStatement.join(`\n`); 
                      break;
                    }

                    const textDoc = await vscode.workspace.openTextDocument({language: statement.type, content});
                    await vscode.window.showTextDocument(textDoc);
                    break;
                  }

                } else {
                  if (statement.type === `statement`) {
                    resultSetProvider.setError(`Query executed with no data returned.`);
                  } else {
                    vscode.window.showInformationMessage(`Query executed with no data returned.`);
                  }
                }
              }
            }

          } catch (e) {
            let errorText;
            if (typeof e === `string`) {
              errorText = e.length > 0 ? e : `An error occurred when executing the statement.`;
            } else {
              errorText = e.message || `Error running SQL statement.`;
            }

            if (statement.type === `statement`) {
              resultSetProvider.setError(errorText);
            } else {
              vscode.window.showErrorMessage(errorText);
            }
          }
        }
      }
    }),
  )
}


/**
 * @param {vscode.TextEditor} editor
 * @returns {{type: "statement"|"cl"|"json"|"csv"|"sql", content: string}} Statement
 */
exports.parseStatement = (editor) => {
  const document = editor.document;
  const eol = (document.eol === vscode.EndOfLine.LF ? `\n` : `\r\n`);

  let text = document.getText(editor.selection).trim();
  let content;

  /** @type {"statement"|"cl"|"json"|"sql"} */
  let type = `statement`;

  if (text.length > 0) {
    content = text;
  } else {
    const cursor = editor.document.offsetAt(editor.selection.active);
    text = document.getText();

    let statements = [];

    let inQuote = false;
    let start = 0, end = 0;

    for (const c of text) {
      switch (c) {
      case `'`:
        inQuote = !inQuote;
        break;

      case `;`:
        if (!inQuote) {
          statements.push({
            start,
            end,
            text: text.substring(start, end)
          });

          start = end+1;
        }
        break;
      }
      end++;
    }

    //Add ending
    statements.push({
      start,
      end,
      text: text.substring(start, end)
    });

    let statementData = statements.find(range => cursor >= range.start && cursor <= range.end);
    content = statementData.text.trim();

    editor.selection = new vscode.Selection(editor.document.positionAt(statementData.start), editor.document.positionAt(statementData.end));

    // Remove blank lines and comment lines
    let lines = content.split(eol).filter(line => line.trim().length > 0 && !line.trimStart().startsWith(`--`));

    lines.forEach((line, startIndex) => {
      if (type !== `statement`) return;
      
      [`cl`, `json`, `csv`, `sql`].forEach(mode => {
        if (line.trim().toLowerCase().startsWith(mode + `:`)) {
          lines = lines.slice(startIndex);
          lines[0] = lines[0].substring(mode.length + 1).trim();
    
          content = lines.join(` `);

          //@ts-ignore We know the type.
          type = mode;
        }
      });
    });
  }

  return {
    type,
    content
  };
}