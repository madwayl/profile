import * as core from '@actions/core';
import { promises as fs } from 'fs'

import puppeteer from 'puppeteer'
import { render } from 'resumed'
import { execSync } from 'child_process';

import path from 'path';

const loadTheme = async () => {

    // Get Theme Name
    const themeName = core.getInput('theme') || 'jsonresume-theme-onepage';

    // Install the package dynamically if not already present
    try {
        await import(themeName);
        console.log(`Using cached package ${themeName}`);
    } catch (err) {
        console.log(`Installing ${themeName}...`);
        execSync(`npm install ${themeName}`, { stdio: [0, 1, 2] });
    }

    core.info(`✅ Loaded theme: ${themeName}`);

    return await import(themeName);

}

const generatePDF = async (file, browser, theme) => {

    core.info(`🎨 Generating PDF for ${path.basename(file)}`);

    const fileName = path.parse(file).name;
    const resume = JSON.parse(await fs.readFile(file, 'utf-8'))

    const html = await render(resume, theme)

    const page = await browser.newPage();

    await page.setContent(html, { waitUntil: 'networkidle2' })
    await page.pdf({
        path: `output/${fileName}.pdf`,
        format: 'a4',
        printBackground: true,
        margin: {
            top: '20px',
            right: '20px',
            bottom: '20px',
            left: '20px'
        }
    });

    await page.close()

    core.info(`✅ Rendered ${fileName}.pdf`);
}

async function run() {
    try {
        const dir = core.getInput('folder');

        await fs.mkdir('output', { recursive: true });

        core.info(`✅ Created Output Directory`);

        const theme = await loadTheme();

        const files = (await fs.readdir(dir))
            .filter(f => f.endsWith('.json'))
            .map(f => path.join(dir, f));

        const browser = await puppeteer.launch({
            executablePath: "/usr/bin/google-chrome-stable",
            headless: true,
            args: [
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--disable-dev-shm-usage'
            ],
        });

        for (const f of files) {
            await generatePDF(f, browser, theme)
        }

        await browser.close();

    } catch (err) {
        core.setFailed(err.message);
    }
}

await run();
