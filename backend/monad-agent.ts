import { HumanMessage } from "@langchain/core/messages";
import { MemorySaver } from "@langchain/langgraph";
import { createReactAgent } from "@langchain/langgraph/prebuilt";
import { ChatOpenAI } from "@langchain/openai";
import { ethers } from "ethers";
import { DynamicTool } from "@langchain/core/tools";
import * as dotenv from "dotenv";
import * as fs from "fs";

// Load environment variables
dotenv.config({ path: "../.env" }); // Adjust path to root

// Validate environment variables
function validateEnvironment(): void {
  const missingVars: string[] = [];
  const requiredVars = ["OPENAI_API_KEY", "MONAD_PRIVATE_KEY"];
  requiredVars.forEach(varName => {
    if (!process.env[varName]) {
      missingVars.push(varName);
    }
  });
  if (missingVars.length > 0) {
    throw new Error(`Missing environment variables: ${missingVars.join(", ")}`);
  }
}

validateEnvironment();

const WALLET_DATA_FILE = "./monad_wallet_data.txt";

// Custom tools for Monad Testnet
const monadTools = [
  new DynamicTool({
    name: "getWalletDetails",
    description: "Get the wallet address and network details",
    func: async () => {
      const provider = new ethers.JsonRpcProvider("https://testnet-rpc.monad.xyz");
      const wallet = new ethers.Wallet(process.env.MONAD_PRIVATE_KEY!, provider);
      const address = wallet.address;
      const network = await provider.getNetwork();
      return `Wallet address: ${address}, Network: Monad Testnet (Chain ID: ${network.chainId})`;
    },
  }),
  new DynamicTool({
    name: "sendTransaction",
    description: "Send MON tokens to another address on Monad Testnet. Args: { to: string, amount: string }",
    func: async (args: string) => {
      const { to, amount } = JSON.parse(args);
      const provider = new ethers.JsonRpcProvider("https://testnet-rpc.monad.xyz");
      const wallet = new ethers.Wallet(process.env.MONAD_PRIVATE_KEY!, provider);
      const tx = {
        to,
        value: ethers.parseEther(amount),
      };
      const txResponse = await wallet.sendTransaction(tx);
      await txResponse.wait();
      return `Transaction sent: https://testnet.monadexplorer.com/tx/${txResponse.hash}`;
    },
  }),
  new DynamicTool({
    name: "getBalance",
    description: "Check the MON balance of the wallet",
    func: async () => {
      const provider = new ethers.JsonRpcProvider("https://testnet-rpc.monad.xyz");
      const wallet = new ethers.Wallet(process.env.MONAD_PRIVATE_KEY!, provider);
      const balance = await provider.getBalance(wallet.address);
      return `Balance: ${ethers.formatEther(balance)} MON`;
    },
  }),
];

// Initialize the agent
async function initializeAgent() {
  const llm = new ChatOpenAI({
    model: "gpt-4o-mini",
  });

  const memory = new MemorySaver();
  const agent = createReactAgent(
    llm,
    monadTools,
    `
      You are a helpful agent that can interact onchain with the Monad Testnet (Chain ID 10143). Use your tools to perform actions like checking wallet details, sending transactions, or getting balances. If you need funds, provide your wallet address and ask the user to send MON testnet tokens, as there’s no faucet integrated here. Before any action, confirm the wallet details. If an action isn’t possible with the available tools, say so and suggest the user explore further at https://docs.monad.xyz. Be concise and helpful.
    `,
    memory
  );

  const provider = new ethers.JsonRpcProvider("https://testnet-rpc.monad.xyz");
  const wallet = new ethers.Wallet(process.env.MONAD_PRIVATE_KEY!, provider);
  const walletData = { address: wallet.address, network: "monad-testnet" };
  fs.writeFileSync(WALLET_DATA_FILE, JSON.stringify(walletData));

  return { agent, config: { configurable: { thread_id: "Monad Testnet Agent" } } };
}

// Export the agent processing function
export async function processMessage(message: string): Promise<string> {
  const { agent, config } = await initializeAgent();
  const stream = await agent.stream({ messages: [new HumanMessage(message)] }, config);
  let response = "";

  for await (const chunk of stream) {
    if ("agent" in chunk) {
      response += chunk.agent.messages[0].content;
    } else if ("tools" in chunk) {
      response += chunk.tools.messages[0].content;
    }
  }

  return response;
}

// For standalone execution (optional)
if (import.meta.url === `file://${process.argv[1]}`) {
  console.log("Starting Monad Testnet Agent...");
  processMessage("Show me my wallet details").then(console.log).catch(console.error);
}