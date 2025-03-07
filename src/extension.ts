import * as vscode from 'vscode';
import { exec } from 'child_process';
import * as path from 'path';
import * as fs from 'fs';

export function activate(context: vscode.ExtensionContext) {
    console.log('Extension "Kaggle to Notebook" is now active!');

    let disposable = vscode.commands.registerCommand('kaggle-to-notebook.fetchKaggleNotebook', async () => {
        try {
            const url = await vscode.window.showInputBox({
                prompt: 'Enter the Kaggle Notebook URL',
                placeHolder: 'https://www.kaggle.com/code/username/notebook-slug'
            });

            if (!url) {
                vscode.window.showErrorMessage('No URL provided. Please enter a valid Kaggle notebook URL.');
                return;
            }

            const match = url.match(/https:\/\/www\.kaggle\.com\/code\/([^\/]+)\/([^\/]+)/);
            if (!match) {
                vscode.window.showErrorMessage('Invalid Kaggle notebook URL.');
                return;
            }

            const username = match[1];
            const slug = match[2];

            // Ask the user for a save location (default to workspace 'notebooks' folder)
            const selectedFolder = await vscode.window.showOpenDialog({
                canSelectFolders: true,
                canSelectFiles: false,
                canSelectMany: false,
                openLabel: "Select folder to save notebook"
            });

            const outputPath = selectedFolder
                ? selectedFolder[0].fsPath
                : path.join(vscode.workspace.rootPath || __dirname, 'notebooks');

            if (!fs.existsSync(outputPath)) {
                fs.mkdirSync(outputPath, { recursive: true });
            }

            const command = `kaggle kernels pull ${username}/${slug} -p "${outputPath}" --metadata `;

            await vscode.window.withProgress({
                location: vscode.ProgressLocation.Notification,
                title: "Fetching Kaggle Notebook...",
                cancellable: false
            }, async () => {
                try {
                    await execPromise(command);
                    const notebookPath = path.join(outputPath, `${slug}.ipynb`);

                    if (!fs.existsSync(notebookPath)) {
                        vscode.window.showErrorMessage(`Notebook not found at: ${notebookPath}`);
                        return;
                    }

                    const doc = await vscode.workspace.openTextDocument(notebookPath);
                    vscode.window.showTextDocument(doc);
                    vscode.window.showInformationMessage('Kaggle notebook fetched successfully!');

                    // Open the folder in VS Code
                    vscode.commands.executeCommand('revealFileInOS', vscode.Uri.file(outputPath));

                } catch (error) {
                    handleError(error, 'Failed to fetch Kaggle notebook.');
                }
            });

        } catch (error) {
            handleError(error, 'Unexpected error while fetching the Kaggle notebook.');
        }
    });

    context.subscriptions.push(disposable);
}

export function deactivate() { }

// Helper function to execute commands asynchronously
function execPromise(command: string): Promise<void> {
    return new Promise((resolve, reject) => {
        exec(command, (error, stdout, stderr) => {
            if (error) {
                if (stderr.includes('403')) {
                    reject(new Error('This notebook is private. Please log in to Kaggle and ensure your API token is valid.'));
                } else {
                    reject(new Error(`Failed to pull notebook: ${stderr || error.message}`));
                }
                return;
            }
            console.log(stdout);
            resolve();
        });
    });
}

// Generic error handler
function handleError(error: unknown, defaultMessage: string) {
    console.error('Error:', error);
    if (error instanceof Error) {
        vscode.window.showErrorMessage(error.message || defaultMessage);
    } else {
        vscode.window.showErrorMessage(defaultMessage);
    }
}