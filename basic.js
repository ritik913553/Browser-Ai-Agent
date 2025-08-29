import "dotenv/config";
import { Agent, run, tool } from "@openai/agents";
import { z } from "zod";


const getCurrentTime = tool({
    name: "get_current_time",
    description: "This tool returns the current time",
    parameters: z.object({}),
    async execute({}) {
        return new Date().toString();
    },
});


const getMenuTool = tool({
  name: 'get_menu',
  description: 'Fetches and returns the menu items',
  parameters: z.object({}),
  async execute({}) {
    return {
      Drinks: {
        Chai: 'INR 50',
        Coffee: 'INR 70',
      },
      Veg: {
        DalMakhni: 'INR 250',
        Panner: 'INR 400',
      },
    };
  },
});

const cookingAgent = new Agent({
    name: "Cooking Agent",
    model: "gpt-4.1-mini",
    tools: [getCurrentTime, getMenuTool],
    instructions: `
    You're a helpfull cooking assistant who is speacialized in cooking food.
    You help the users with food options and receipes and help them cook food
  `,
});

async function main() {
    const result = await run(cookingAgent,'Hey');
    console.log(result.finalOutput);
}
main();