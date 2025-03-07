// // blockchainAgentServer.ts
// import { ChatOpenAI } from "@langchain/openai";
// import { StateGraph, END } from "@langchain/langgraph";
// import { HumanMessage, AIMessage, BaseMessage } from "@langchain/core/messages";
// import { ToolNode } from "@langchain/langgraph/prebuilt";
// import { z } from "zod";
// import { StructuredTool } from "@langchain/core/tools";
// import { ethers } from "ethers";
// import * as dotenv from "dotenv";
// import express, { Request, Response, RequestHandler } from "express";
// import bodyParser from "body-parser";

// dotenv.config();

// // Environment variables
// const OPENAI_API_KEY = process.env.OPENAI_API_KEY || "";
// const MONAD_RPC_URL = "https://testnet-rpc.monad.xyz"; // Replace with actual Monad testnet RPC

// // Initialize OpenAI model
// const llm = new ChatOpenAI({
//   model: "gpt-4o-mini",
//   apiKey: OPENAI_API_KEY,
//   temperature: 0,
// });

// // Define blockchain tools as StructuredTool
// class SetWalletTool extends StructuredTool {
//   schema = z.object({
//     privateKey: z.string().describe("The private key to set the wallet"),
//   });

//   name = "setWallet";
//   description = "Set the wallet using a private key";

//   private provider = new ethers.JsonRpcProvider(MONAD_RPC_URL);
//   private wallet: ethers.Wallet | null = null;

//   async _call({ privateKey }: { privateKey: string }) {
//     this.wallet = new ethers.Wallet(privateKey, this.provider);
//     return `Wallet set to address: ${this.wallet.address}`;
//   }

//   getWallet() {
//     return this.wallet;
//   }
// }

// class GetWalletAddressTool extends StructuredTool {
//   schema = z.object({});

//   name = "getWalletAddress";
//   description = "Get the current wallet address";

//   constructor(private setWalletTool: SetWalletTool) {
//     super();
//   }

//   async _call() {
//     const wallet = this.setWalletTool.getWallet();
//     if (!wallet) return "No wallet set. Please provide a private key.";
//     return wallet.address;
//   }
// }

// class TransferTokensTool extends StructuredTool {
//   schema = z.object({
//     to: z.string().describe("The recipient address"),
//     amount: z.string().describe("The amount of tokens to transfer"),
//   });

//   name = "transferTokens";
//   description = "Transfer tokens to an address";

//   constructor(private setWalletTool: SetWalletTool) {
//     super();
//   }

//   async _call({ to, amount }: { to: string; amount: string }) {
//     const wallet = this.setWalletTool.getWallet();
//     if (!wallet) return "No wallet set.";
//     const tx = {
//       to,
//       value: ethers.parseEther(amount),
//     };
//     const txResponse = await wallet.sendTransaction(tx);
//     await txResponse.wait();
//     return `Transferred ${amount} tokens to ${to}. Tx: ${txResponse.hash}`;
//   }
// }

// class SignMessageTool extends StructuredTool {
//   schema = z.object({
//     message: z.string().describe("The message to sign"),
//   });

//   name = "signMessage";
//   description = "Sign a message with the wallet";

//   constructor(private setWalletTool: SetWalletTool) {
//     super();
//   }

//   async _call({ message }: { message: string }) {
//     const wallet = this.setWalletTool.getWallet();
//     if (!wallet) return "No wallet set.";
//     const signature = await wallet.signMessage(message);
//     return `Message signed: ${signature}`;
//   }
// }

// // Instantiate tools
// const setWalletTool = new SetWalletTool();
// const tools = [
//   setWalletTool,
//   new GetWalletAddressTool(setWalletTool),
//   new TransferTokensTool(setWalletTool),
//   new SignMessageTool(setWalletTool),
// ];

// // Correctly type the ToolNode
// const toolNode = new ToolNode<AgentState>(tools);

// // Bind tools to LLM
// const modelWithTools = llm.bindTools(tools);

// // Define state with proper typing
// interface AgentState {
//   messages: BaseMessage[];
// }

// // Agent logic
// async function callAgent(state: AgentState): Promise<Partial<AgentState>> {
//   const response = await modelWithTools.invoke(state.messages);
//   return { messages: [response] };
// }

// function shouldContinue(state: AgentState): string {
//   const lastMessage = state.messages[state.messages.length - 1];
//   // Check if lastMessage is an AIMessage with tool_calls
//   if ("tool_calls" in lastMessage && Array.isArray(lastMessage.tool_calls) && lastMessage.tool_calls.length > 0) {
//     return "tools";
//   }
//   return END;
// }

// // Define the workflow
// const workflow = new StateGraph<AgentState>({
//   channels: {
//     messages: {
//       reducer: (x?: BaseMessage[], y?: BaseMessage[]) => (x ?? []).concat(y ?? []),
//       default: () => [],
//     },
//   },
// })
//   .addNode("agent", callAgent)
//   .addNode("tools", toolNode)
//   .addEdge("__start__", "agent")
//   .addEdge("tools", "agent")
//   .addConditionalEdges("agent", shouldContinue);

// // Compile the graph
// const agent = workflow.compile();

// // Express server setup
// const app = express();
// app.use(bodyParser.json());

// // Explicitly type the handler as RequestHandler and ensure it returns void
// const agentHandler: RequestHandler = async (req: Request, res: Response): Promise<void> => {
//   const { input, privateKey } = req.body as { input?: string; privateKey?: string };

//   if (!input) {
//     res.status(400).json({ error: "Input is required" });
//     return;
//   }

//   try {
//     const messages: BaseMessage[] = [];
//     if (privateKey) {
//       messages.push(new HumanMessage(`Set wallet with private key: ${privateKey}`));
//     }
//     messages.push(new HumanMessage(input));

//     const result = await agent.invoke({ messages });
//     const lastMessage = result.messages[result.messages.length - 1];
//     res.json({ response: lastMessage.content });
//   } catch (error) {
//     console.error(error);
//     res.status(500).json({ error: "Internal server error" });
//   }
// };

// app.post("/agent", agentHandler);

// // Start the server
// const PORT = 3000;
// app.listen(PORT, () => {
//   console.log(`Server running on http://localhost:${PORT}`);
// });

// blockchainAgentServer.ts
import { ChatOpenAI } from "@langchain/openai";
import { StateGraph, END } from "@langchain/langgraph";
import { HumanMessage, AIMessage, BaseMessage } from "@langchain/core/messages";
import { ToolNode } from "@langchain/langgraph/prebuilt";
import { z } from "zod";
import { StructuredTool } from "@langchain/core/tools";
import { ethers } from "ethers";
import * as dotenv from "dotenv";
import express, { Request, Response, RequestHandler } from "express";
import bodyParser from "body-parser";

dotenv.config();

// Environment variables
const OPENAI_API_KEY = process.env.OPENAI_API_KEY || "";
const MONAD_RPC_URL = process.env.MONAD_RPC_URL || "https://testnet-rpc.monad.xyz"; // Set in .env

// Initialize OpenAI model
const llm = new ChatOpenAI({
  model: "gpt-4o-mini",
  apiKey: OPENAI_API_KEY,
  temperature: 0,
});

// Define blockchain tools as StructuredTool
class SetWalletTool extends StructuredTool {
  schema = z.object({
    privateKey: z.string().describe("The private key to set the wallet"),
  });

  name = "setWallet";
  description = "Set the wallet using a private key";

  private provider = new ethers.JsonRpcProvider(MONAD_RPC_URL);
  private wallet: ethers.Wallet | null = null;

  async _call({ privateKey }: { privateKey: string }) {
    try {
      this.wallet = new ethers.Wallet(privateKey, this.provider);
      return `Wallet set to address: ${this.wallet.address}`;
    } catch (error) {
      console.error("SetWalletTool error:", error);
      throw new Error(`Failed to set wallet: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  getWallet() {
    return this.wallet;
  }
}

class GetWalletAddressTool extends StructuredTool {
  schema = z.object({});

  name = "getWalletAddress";
  description = "Get the current wallet address";

  constructor(private setWalletTool: SetWalletTool) {
    super();
  }

  async _call() {
    const wallet = this.setWalletTool.getWallet();
    if (!wallet) return "No wallet set. Please provide a private key.";
    return wallet.address;
  }
}

class TransferTokensTool extends StructuredTool {
  schema = z.object({
    to: z.string().describe("The recipient address"),
    amount: z.string().describe("The amount of tokens to transfer"),
  });

  name = "transferTokens";
  description = "Transfer tokens to an address";

  constructor(private setWalletTool: SetWalletTool) {
    super();
  }

  async _call({ to, amount }: { to: string; amount: string }) {
    try {
      const wallet = this.setWalletTool.getWallet();
      if (!wallet) return "No wallet set.";
      const tx = {
        to,
        value: ethers.parseEther(amount),
      };
      const txResponse = await wallet.sendTransaction(tx);
      await txResponse.wait();
      return `Transferred ${amount} tokens to ${to}. Tx: ${txResponse.hash}`;
    } catch (error) {
      console.error("TransferTokensTool error:", error);
      throw new Error(`Failed to transfer tokens: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
}

class SignMessageTool extends StructuredTool {
  schema = z.object({
    message: z.string().describe("The message to sign"),
  });

  name = "signMessage";
  description = "Sign a message with the wallet";

  constructor(private setWalletTool: SetWalletTool) {
    super();
  }

  async _call({ message }: { message: string }) {
    try {
      const wallet = this.setWalletTool.getWallet();
      if (!wallet) return "No wallet set.";
      const signature = await wallet.signMessage(message);
      return `Message signed: ${signature}`;
    } catch (error) {
      console.error("SignMessageTool error:", error);
      throw new Error(`Failed to sign message: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
}

// Instantiate tools
const setWalletTool = new SetWalletTool();
const tools = [
  setWalletTool,
  new GetWalletAddressTool(setWalletTool),
  new TransferTokensTool(setWalletTool),
  new SignMessageTool(setWalletTool),
];

// Correctly type the ToolNode
const toolNode = new ToolNode<AgentState>(tools);

// Bind tools to LLM
const modelWithTools = llm.bindTools(tools);

// Define state with proper typing
interface AgentState {
  messages: BaseMessage[];
}

// Agent logic
async function callAgent(state: AgentState): Promise<Partial<AgentState>> {
  const response = await modelWithTools.invoke(state.messages);
  return { messages: [response] };
}

function shouldContinue(state: AgentState): string {
  const lastMessage = state.messages[state.messages.length - 1];
  if ("tool_calls" in lastMessage && Array.isArray(lastMessage.tool_calls) && lastMessage.tool_calls.length > 0) {
    return "tools";
  }
  return END;
}

// Define the workflow
const workflow = new StateGraph<AgentState>({
  channels: {
    messages: {
      reducer: (x?: BaseMessage[], y?: BaseMessage[]) => (x ?? []).concat(y ?? []),
      default: () => [],
    },
  },
})
  .addNode("agent", callAgent)
  .addNode("tools", toolNode)
  .addEdge("__start__", "agent")
  .addEdge("tools", "agent")
  .addConditionalEdges("agent", shouldContinue);

// Compile the graph
const agent = workflow.compile();

// Express server setup
const app = express();
app.use(bodyParser.json());

// Explicitly type the handler as RequestHandler and ensure it returns void
const agentHandler: RequestHandler = async (req: Request, res: Response): Promise<void> => {
  const { input, privateKey } = req.body as { input?: string; privateKey?: string };

  if (!input) {
    res.status(400).json({ error: "Input is required" });
    return;
  }

  try {
    const messages: BaseMessage[] = [];
    if (privateKey) {
      messages.push(new HumanMessage(`Set wallet with private key: ${privateKey}`));
    }
    messages.push(new HumanMessage(input));

    const result = await agent.invoke({ messages });
    const lastMessage = result.messages[result.messages.length - 1];
    res.json({ response: lastMessage.content });
  } catch (error) {
    console.error("Agent handler error:", error);
    res.status(500).json({ error: `Internal server error: ${error instanceof Error ? error.message : String(error)}` });
  }
};

app.post("/agent", agentHandler);

// Start the server
const PORT = 3000;
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});