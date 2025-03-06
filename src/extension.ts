import * as vscode from 'vscode';
import { exec } from 'child_process';
import * as path from 'path';
import * as fs from 'fs';

export function activate(context: vscode.ExtensionContext) {
    console.log('Extension "Kaggle to Notebook" is now active!');

    let disposable = vscode.commands.registerCommand('kaggle-to-notebook.fetchKaggleNotebook', async () => {
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
        const outputPath = path.join(__dirname, 'notebooks');

        if (!fs.existsSync(outputPath)) {
            fs.mkdirSync(outputPath, { recursive: true });
        }

        try {
            const command = `kaggle kernels pull ${username}/${slug} -p ${outputPath}`;
            console.log('Running command:', command);

            exec(command, (error, stdout, stderr) => {
                if (error) {
                    if (stderr.includes('403')) {
                        vscode.window.showErrorMessage('This notebook is private. Please log in to Kaggle and ensure your API token is valid.');
                    } else {
                        vscode.window.showErrorMessage(`Failed to pull notebook: ${stderr}`);
                    }
                    return;
                }

                console.log('Command output:', stdout);

                const notebookPath = path.join(outputPath, `${slug}.ipynb`);
                console.log('Notebook path:', notebookPath);

                if (!fs.existsSync(notebookPath)) {
                    vscode.window.showErrorMessage(`Notebook not found at: ${notebookPath}`);
                    return;
                }

                vscode.workspace.openTextDocument(notebookPath).then(doc => {
                    vscode.window.showTextDocument(doc);
                    // Set the language mode based on the file extension
                    const fileExtension = path.extname(notebookPath);
                    let languageId = 'plaintext'; // Default language

                    if (fileExtension === '.ipynb') {
                        languageId = 'python'; // Jupyter Notebook
                    } else if (fileExtension === '.py') {
                        languageId = 'python'; // Python script
                    } else if (fileExtension === '.md') {
                        languageId = 'markdown'; // Markdown file
                    }
                    vscode.languages.setTextDocumentLanguage(doc, languageId);
                    vscode.window.showInformationMessage('Kaggle notebook fetched successfully!');
                });

            });
        } catch (error) {
            console.error('Error:', error);
            vscode.window.showErrorMessage(`Failed to fetch Kaggle notebook: ${error}`);
        }
    });

    context.subscriptions.push(disposable);
}

export function deactivate() { }