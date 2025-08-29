import "dotenv/config";
import { Agent, run, tool } from "@openai/agents";
import { z } from "zod";
import { chromium, selectors } from "playwright";
import OpenAI from "openai";
import fs from "fs";
import { randomBytes } from "crypto";
import { promisify } from "util";
import sharp from "sharp";

const fsAsync = {
    writeFile: promisify(fs.writeFile),
    readFile: promisify(fs.readFile),
};

// Initialize browser and page variables but don't launch immediately
let browser;
let page;


// Function to launch browser
async function launchBrowser() {
    if (!browser) {
        browser = await chromium.launch({ headless: false });
        page = await browser.newPage();
    }
    return { browser, page };
}

const openWebsite = tool({
    name: "open_website",
    description: "Opens the given url in the browser",
    parameters: z.object({ url: z.string() }),
    async execute({ url }) {
        console.log(`⚒️ OpenWebsite tool call happens with URL: ${url}`);
        const { page } = await launchBrowser();
        await page.goto(url);
    },
});

const takeScreenshot = tool({
    name: "take_screenshot",
    description: "Takes a screenshot of the current page",
    parameters: z.object({}),
    async execute() {
        console.log("TakeScreenshot tool call happens");
        const { page } = await launchBrowser();
        const screenshot = await page.screenshot({
            type: "jpeg",
            quality: 20,
            fullPage: false,
        });

        const compressed = await sharp(screenshot)
            .resize({ width: 1024, height: 720 })
            .webp({ quality: 10 })
            .toBuffer();
        const base64 = compressed.toString("base64");

        const randomName = `${randomBytes(16).toString("hex")}.webp`;
        const screenshotPath = `temp/${randomName}`;
        await fsAsync.writeFile(screenshotPath, compressed);

        console.log(
            `Screen shot is taken successfully and saved in ${screenshotPath} this screen shot passed to the llm`
        );

        // console.log("Screenshot taken successfully:", base64);
        console.log("Screenshot path:", base64.length);
        // return screenshot;
    },
});

const clickElement = tool({
    name: "click_element",
    description: "Clicks on the given selector",
    parameters: z.object({
        selector: z.string(),
    }),
    async execute({ selector }) {
        console.log(`⚒️ ClickElement tool called with selector: ${selector}`);
        const { page } = await launchBrowser();
        await page.click(selector);
        return `Clicked on ${selector}`;
    },
});

const fillForm = tool({
    name: "fill_form",
    description: "Fills multiple input fields with values",
    parameters: z.object({
        fields: z.array(
            z.object({
                selector: z.string(),
                value: z.string(),
            })
        ),
    }),
    async execute({ fields }) {
        console.log(`⚒️ FillForm tool called with fields:`, fields);
        const { page } = await launchBrowser();

        for (const field of fields) {
            console.log(`Filling ${field.selector} with "${field.value}"`);
            await page.fill(field.selector, field.value);
        }

        return `Filled ${fields.length} fields successfully`;
    },
});


const extractElements = tool({
    name: "extract_elements",
    description: "Extract elements from the page based on type",
    parameters: z.object({
        elementTypes: z
            .array(z.enum(["input", "button", "a", "label"]))
            .nullable(),
            
    }),
    async execute({ elementTypes }) {
        console.log("⚒️ ExtractElements tool call happens with", elementTypes);
        const { page } = await launchBrowser();
        const selector =
            elementTypes && elementTypes.length > 0
                ? elementTypes.join(", ")
                : "input, button";

        const elements = await page.$$eval(selector, (els) =>
            els.map((el) => ({
                selector:
                    el.tagName.toLowerCase() +
                    (el.id ? `#${el.id}` : "") +
                    (el.className
                        ? "." + el.className.split(" ").join(".")
                        : ""),
                type: el.tagName.toLowerCase(),
                text: el.innerText || el.value || "",
                placeholder: el.placeholder || "",
                name: el.name || "",
            }))
        );
        // console.log("Extracted elements:", elements);
        return elements;
    },
});

const websiteAutomationAgent = new Agent({
    name: "websiteAutomationAgent",
    instructions: `
        You are a browser automation agent.  

        Workflow:  
        1. Use open_website to go to the target page.  
        2. Use extract_elements to see what inputs, buttons, or links are available.  
        3. Based on the user’s query:  
        - If you need to click a button or link, call click_element with the correct selector.  
        - If you need to fill out a form, call fill_form with the list of input selectors and their values.  
        4. Repeat steps 2–3 until the user’s task is completed.  

        Rules:  
        - Always choose the most relevant selector that matches the user’s intent.  
        - Prefer fill_form for filling multiple fields in one call instead of separate actions.  
        - After completing the action(s), confirm that the task was done and end the conversation. 

    `,
    tools: [openWebsite, extractElements, clickElement,fillForm],
});

async function main() {
    const Query = 'go to https://ui.chaicode.com/auth/signup and fill the signup form with random data then go https://ui.chaicode.com/auth/login and fill the login form wuith same data that is for signup'
    console.log("User Query: ",Query);
    const res = await run(
        websiteAutomationAgent,
        Query
    );
    console.log(res.finalOutput);
}

main();
