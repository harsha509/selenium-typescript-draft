import * as path from 'path';
import * as cp from 'child_process';

export function getJavaPath(): string {
    return process.env['JAVA_HOME']
        ? path.join(process.env['JAVA_HOME'], 'bin/java')
        : 'java';
}

export function isSelenium3x(seleniumStandalonePath: string): boolean {
    const javaPath = getJavaPath();

    const execRes = cp.execSync(
        `${javaPath} -jar ${seleniumStandalonePath} --version`
    );

    return execRes.toString().trim().startsWith('Selenium server version: 3');
}

export function formatSpawnArgs(
    seleniumStandalonePath: string,
    args: string[]
): string[] {
    if (isSelenium3x(seleniumStandalonePath)) {
        console.warn(
            'Deprecation: Support for Standalone Server 3.x will be removed soon. Please update to version 4.x'
        );
        return args;
    }

    const standaloneArg = 'standalone';
    const port3xArgFormat = '-port';
    const port4xArgFormat = '--port';

    let formattedArgs = Array.from(args);

    const standaloneArgIndex = formattedArgs.findIndex(
        (arg) => arg === seleniumStandalonePath
    );
    const v3portArgFormat = formattedArgs.findIndex(
        (arg) => arg === port3xArgFormat
    );

    // old v3x port arg format was -port, new v4x port arg format is --port
    if (v3portArgFormat !== -1) {
        formattedArgs[v3portArgFormat] = port4xArgFormat;
    }

    // 'standalone' arg should be right after jar file path
    // in case if it is already in place - returns args
    if (formattedArgs[standaloneArgIndex + 1] === standaloneArg) return formattedArgs;

    // insert 'standalone' right after jar file path
    formattedArgs.splice(standaloneArgIndex + 1, 0, standaloneArg);

    return formattedArgs;
}
