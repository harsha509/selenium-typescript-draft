import * as childProcess from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import { platform } from 'process';

const Browser = ['chrome', 'firefox', 'edge', 'iexplorer'];

function getBinary(): string {
    // @ts-ignore
    const directory = {
        darwin: 'macos',
        win32: 'windows',
        cygwin: 'windows',
        linux: 'linux',
    }[platform];

    const file = directory === 'windows' ? 'selenium-manager.exe' : 'selenium-manager';

    const filePath = path.join(__dirname, '..', '/bin', directory, file);

    if (!fs.existsSync(filePath)) {
        throw new Error(`Unable to obtain Selenium Manager`);
    }

    return filePath;
}

function driverLocation(browser: string): string {
    if (!Browser.includes(browser.toLocaleString())) {
        throw new Error(
            `Unable to locate driver associated with browser name: ${browser}`
        );
    }

    let args = [getBinary(), '--browser', browser];
    let result: string;

    try {
        result = childProcess.execSync(args.join(' ')).toString();
    } catch (e) {
        throw new Error(
            `Error executing command with ${args}\n${e.stdout.toString()}${e.stderr.toString()}`
        );
    }

    if (!result.startsWith('INFO\t')) {
        throw new Error(`Unsuccessful command executed: ${args}\n${result}`);
    }

    return result.replace('INFO\t', '').trim();
}

export { driverLocation };
