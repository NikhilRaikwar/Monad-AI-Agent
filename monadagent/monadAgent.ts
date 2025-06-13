import { ChatOpenAI } from "@langchain/openai";
import { StateGraph, END } from "@langchain/langgraph";
import { HumanMessage, AIMessage, BaseMessage, SystemMessage } from "@langchain/core/messages";
import { ToolNode } from "@langchain/langgraph/prebuilt";
import { z } from "zod";
import { StructuredTool } from "@langchain/core/tools";
import { ethers } from "ethers";
import * as dotenv from "dotenv";
import express, { Request, Response, RequestHandler } from "express";
import bodyParser from "body-parser";
import axios from "axios";
import { Logger } from "tslog";
import cors from "cors";

dotenv.config();

// Logger setup
const log = new Logger({ name: "NexisAgent", minLevel: 0, prettyLogTemplate: "{{yyyy}}.{{mm}}.{{dd}} {{hh}}:{{MM}}:{{ss}} {{logLevelName}} {{name}} - " });

// Environment variables
const OPENAI_API_KEY = process.env.OPENAI_API_KEY || "";
const COINGECKO_API_KEY = process.env.COINGECKO_API_KEY || "";
const MONAD_RPC_URL = process.env.MONAD_RPC_URL || "https://testnet-rpc.monad.xyz";
const MONAD_EXPLORER_URL = "https://monad-testnet.socialscan.io";
const MONAD_FAUCET_URL = "https://testnet.monad.xyz/";

// Validate environment variables
const validateEnvVars = async () => {
  const errors: string[] = [];
  if (!OPENAI_API_KEY) errors.push("OPENAI_API_KEY is not set in .env file");
  if (!COINGECKO_API_KEY) log.warn("COINGECKO_API_KEY not set. Token price queries may be limited.");
  if (!MONAD_RPC_URL) errors.push("MONAD_RPC_URL is not set.");

  const testRpcConnection = async (url: string, chain: string) => {
    try {
      const provider = new ethers.JsonRpcProvider(url);
      await provider.getBlockNumber();
      log.info(`RPC connection successful for ${chain}: ${url}`);
    } catch (error) {
      errors.push(`Failed to connect to ${chain} RPC at ${url}: ${error instanceof Error ? error.message : String(error)}`);
    }
  };

  await testRpcConnection(MONAD_RPC_URL, "Monad Testnet");

  if (errors.length > 0) {
    log.error("Environment variable errors:", errors.join(", "));
    process.exit(1);
  }
  log.info("Environment variables validated successfully");
  log.info(`OPENAI_API_KEY: ${OPENAI_API_KEY ? "Set" : "Not set"}`);
  log.info(`COINGECKO_API_KEY: ${COINGECKO_API_KEY ? "Set" : "Not set"}`);
  log.info(`MONAD_RPC_URL: ${MONAD_RPC_URL}`);
};
validateEnvVars().catch((error) => {
  log.error("Failed to validate environment variables:", error);
  process.exit(1);
});

// ERC-20 ABI for interacting with tokens
const ERC20_ABI = [
  "function balanceOf(address account) public view returns (uint256)",
  "function transfer(address to, uint256 value) public returns (bool)",
];

// Initialize OpenAI model
const llm = new ChatOpenAI({
  model: "gpt-4o-mini",
  apiKey: OPENAI_API_KEY,
  temperature: 0,
});

// Blockchain tools
class BlockchainTools {
  private provider: ethers.JsonRpcProvider;
  private wallet: ethers.Wallet | null = null;

  constructor() {
    this.provider = new ethers.JsonRpcProvider(MONAD_RPC_URL);
    log.info("Provider initialized for Monad Testnet");
  }

  getProvider(): ethers.JsonRpcProvider {
    return this.provider;
  }

  getWallet(): ethers.Wallet | null {
    return this.wallet;
  }

  setWallet(wallet: ethers.Wallet): void {
    this.wallet = wallet;
    log.info(`Wallet set for Monad Testnet`);
  }

  clearWallet(): void {
    this.wallet = null;
    log.info("Wallet cleared from memory");
  }
}

// Define tools
class SetWalletTool extends StructuredTool {
  schema = z.object({
    privateKey: z.string().describe("The private key to set the wallet"),
  });

  name = "setWallet";
  description = "Set the wallet using a private key for Monad Testnet. Required for transactions.";

  constructor(private tools: BlockchainTools) {
    super();
  }

  async _call({ privateKey }: { privateKey: string }) {
    try {
      const wallet = new ethers.Wallet(privateKey, this.tools.getProvider());
      this.tools.setWallet(wallet);
      log.info(`Wallet set to address: ${wallet.address}`);
      return `✅ Wallet set for Monad Testnet at address: ${wallet.address}. You can now perform transactions.`;
    } catch (error) {
      log.error("SetWalletTool error:", error);
      throw new Error(`Failed to set wallet: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
}

class DisconnectWalletTool extends StructuredTool {
  schema = z.object({});

  name = "disconnectWallet";
  description = "Disconnect the current wallet and clear it from memory";

  constructor(private tools: BlockchainTools) {
    super();
  }

  async _call() {
    this.tools.clearWallet();
    return "🔌 Wallet disconnected successfully";
  }
}

class GetWalletAddressTool extends StructuredTool {
  schema = z.object({});

  name = "getWalletAddress";
  description = "Get the current wallet address for Monad Testnet";

  constructor(private tools: BlockchainTools) {
    super();
  }

  async _call() {
    const wallet = this.tools.getWallet();
    if (!wallet) return "🚫 No wallet set. Please set a wallet using 'setWallet <privateKey>' first.";
    return `📍 Monad Testnet wallet address: ${wallet.address}`;
  }
}

class GetBalanceTool extends StructuredTool {
  schema = z.object({});

  name = "getBalance";
  description = "Get the MONAD balance for the connected wallet";

  constructor(private tools: BlockchainTools) {
    super();
  }

  async _call() {
    const wallet = this.tools.getWallet();
    if (!wallet) return "🚫 No wallet set. Please set a wallet using 'setWallet <privateKey>' first.";

    const balances: string[] = [];
    try {
      const monadBalance = await this.tools.getProvider().getBalance(wallet.address);
      balances.push(`💰 MONAD Balance: ${ethers.formatEther(monadBalance)} MONAD`);
    } catch (error) {
      log.error("Error fetching MONAD balance:", error);
      balances.push("❌ Unable to fetch MONAD balance");
    }

    return balances.length > 0 ? `📊 **Monad Testnet Portfolio**:\n${balances.join("\n")}` : "No balances available.";
  }
}

class TransferTokensTool extends StructuredTool {
  schema = z.object({
    to: z.string().describe("The recipient address"),
    amount: z.string().describe("The amount of MONAD to transfer"),
  });

  name = "transferTokens";
  description = "Transfer MONAD tokens to an address on Monad Testnet";

  constructor(private tools: BlockchainTools) {
    super();
  }

  async _call({ to, amount }: { to: string; amount: string }) {
    const wallet = this.tools.getWallet();
    if (!wallet) return "🚫 No wallet set. Please set a wallet using 'setWallet <privateKey>' first.";
    if (!ethers.isAddress(to)) return `❌ Invalid recipient address: ${to}`;
    if (isNaN(Number(amount)) || Number(amount) <= 0) return `❌ Invalid amount: ${amount}`;

    try {
      const tx = { to, value: ethers.parseEther(amount) };
      const txResponse = await wallet.sendTransaction(tx);
      const receipt = await txResponse.wait();
      log.info(`Transfer: ${amount} MONAD to ${to}, Tx: ${txResponse.hash}`);
      return `✅ Transferred ${amount} MONAD to ${to}. [View Transaction](${MONAD_EXPLORER_URL}/tx/${txResponse.hash})`;
    } catch (error) {
      log.error("TransferTokensTool error:", error);
      return `❌ Failed to transfer tokens: ${error instanceof Error ? error.message : String(error)}`;
    }
  }
}

class GetTokenPriceTool extends StructuredTool {
  schema = z.object({
    token: z.string().describe("Token ticker (e.g., MONAD, ETH, BNB)"),
  });

  name = "getTokenPrice";
  description = "Get real-time token price from CoinGecko";

  async _call({ token }: { token: string }) {
    try {
      const tokenMap: { [key: string]: string } = {
        ETH: "ethereum",
        BNB: "binancecoin",
        MONAD: "monad",
      };
      const coinId = tokenMap[token.toUpperCase()] || token.toLowerCase();
      log.info(`Fetching price for token: ${token}, coinId: ${coinId}`);
      const response = await axios.get<{ [key: string]: { usd: number } }>(
        `https://api.coingecko.com/api/v3/simple/price?ids=${coinId}&vs_currencies=usd`,
        { headers: COINGECKO_API_KEY ? { "x-cg-api-key": COINGECKO_API_KEY } : {}, timeout: 10000 }
      );
      const price = response.data[coinId]?.usd;
      if (!price) {
        log.warn(`Price not found for ${token}`);
        return `❌ Price not found for ${token}`;
      }
      return `💰 **${token.toUpperCase()} Price**: $${price.toLocaleString()} USD`;
    } catch (error) {
      log.error("GetTokenPriceTool error:", error);
      return `❌ Failed to fetch price for ${token}: ${error instanceof Error ? error.message : String(error)}`;
    }
  }
}

class GetFaucetTokensTool extends StructuredTool {
  schema = z.object({
    address: z.string().describe("The wallet address to receive testnet MON tokens"),
  });

  name = "getFaucetTokens";
  description = "Request testnet MON tokens from the Monad faucet";

  async _call({ address }: { address: string }) {
    try {
      if (!ethers.isAddress(address)) return "❌ Invalid Ethereum address provided.";
      return `💧 To get testnet MON tokens for ${address}, visit ${MONAD_FAUCET_URL}, connect your wallet, paste your address (${address}), and click 'Get Testnet MON'. Tokens are available every 12 hours based on eligibility.`;
    } catch (error) {
      log.error("GetFaucetTokensTool error:", error);
      return `❌ Failed to process faucet request: ${error instanceof Error ? error.message : String(error)}`;
    }
  }
}

class HelpTool extends StructuredTool {
  schema = z.object({});

  name = "help";
  description = "List all available commands and features";

  async _call() {
    const commands = [
      "🔐 **Wallet Management**",
      "• setWallet <privateKey> - Set your wallet for Monad Testnet",
      "• disconnectWallet - Disconnect and clear your wallet",
      "• getWalletAddress - Get your wallet address",
      "",
      "💰 **Portfolio and Transactions**",
      "• getBalance - Check your MONAD balance",
      "• transferTokens <to> <amount> - Transfer MONAD tokens",
      "",
      "📊 **Market Information**",
      "• getTokenPrice <token> - Get token price (e.g., MONAD, ETH, BNB)",
      "",
      "💧 **Testnet Support**",
      "• getFaucetTokens <address> - Request testnet MON tokens",
      "",
      "💡 **General Queries**",
      "• Ask any blockchain-related question (e.g., 'What is Monad?', 'Explain smart contracts')",
      "• View portfolio with 'Show my portfolio' or similar phrases",
      "",
      "🔒 **Security Note**",
      "• Keep your private key secure and never share it publicly",
      "• Set wallet before transactions",
    ];
    return `**Nexis Agent Commands**:\n${commands.join("\n")}`;
  }
}

// Instantiate tools
const blockchainTools = new BlockchainTools();
const tools = [
  new SetWalletTool(blockchainTools),
  new DisconnectWalletTool(blockchainTools),
  new GetWalletAddressTool(blockchainTools),
  new GetBalanceTool(blockchainTools),
  new TransferTokensTool(blockchainTools),
  new GetTokenPriceTool(),
  new GetFaucetTokensTool(),
  new HelpTool(),
];

const toolNode = new ToolNode(tools);
const modelWithTools = llm.bindTools(tools);

// Define state
interface AgentState {
  messages: BaseMessage[];
}

// Agent logic
async function callAgent(state: AgentState): Promise<Partial<AgentState>> {
  const systemMessage = new SystemMessage(
    `You are Nexis, a friendly AI-powered Web3 assistant specializing in the Monad Testnet and general blockchain queries. Your capabilities include:

    - Managing wallets and transactions on Monad Testnet
    - Checking MONAD balances for portfolio viewing
    - Fetching real-time token prices via CoinGecko
    - Guiding users to request testnet MON tokens
    - Answering any blockchain-related question (e.g., 'What is a smart contract?', 'How does Monad work?')

    Key guidelines:
    - Parse user input to identify commands (e.g., 'setWallet <key>', 'getBalance') or conversational queries.
    - For portfolio requests (e.g., 'Show my portfolio'), use 'getBalance' if a wallet is set.
    - Use tools for specific commands; otherwise, respond conversationally using your blockchain knowledge.
    - Always require a wallet to be set for transactions using 'setWallet'.
    - Provide clear, engaging responses with emojis and markdown formatting.
    - Prioritize security: remind users to keep private keys safe and never store them.
    - For token prices, use the 'getTokenPrice' tool with CoinGecko.
    - If the user asks a general question, provide accurate, informative answers without invoking tools unless necessary.

    Available chain: Monad Testnet
    Make blockchain interactions simple, secure, and accessible.`
  );
  const messagesWithSystem = [systemMessage, ...state.messages];
  const response = await modelWithTools.invoke(messagesWithSystem);
  return { messages: [response] };
}

function shouldContinue(state: AgentState): string {
  const lastMessage = state.messages[state.messages.length - 1];
  if ("tool_calls" in lastMessage && Array.isArray(lastMessage.tool_calls) && lastMessage.tool_calls.length > 0) {
    return "tools";
  }
  return END;
}

// Define workflow
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

const agent = workflow.compile();

// Express setup
const app = express();
app.use(cors({
  origin: ["https://nexis-mocha.vercel.app", "http://localhost:5173"], // Allow frontend and local dev
  methods: ["GET", "POST", "OPTIONS"],
  allowedHeaders: ["Content-Type"],
}));
app.use(bodyParser.json());

// Root endpoint
app.get("/", (req: Request, res: Response) => {
  res.json({
    message: "Nexis Agent backend running",
    version: "1.0.0",
    supported_chains: ["monad"],
    timestamp: new Date().toISOString(),
  });
});

// Agent handler
const agentHandler: RequestHandler = async (req: Request, res: Response): Promise<void> => {
  try {
    log.info(`Handling ${req.method} request to ${req.url}`);
    const { input, privateKey } = req.body as { input?: string; privateKey?: string };
    if (!input) {
      log.warn("Input is missing in request body");
      res.status(400).json({ error: "Input is required", timestamp: new Date().toISOString() });
      return;
    }

    const messages: BaseMessage[] = [];
    if (privateKey) {
      messages.push(new HumanMessage(`setWallet ${privateKey}`));
    }
    messages.push(new HumanMessage(input));
    log.info(`Processing request: ${input}`);

    const result = await agent.invoke({ messages });
    const lastMessage = result.messages[result.messages.length - 1];
    res.status(200).json({
      response: lastMessage.content,
      tool_calls: "tool_calls" in lastMessage ? lastMessage.tool_calls : [],
      timestamp: new Date().toISOString(),
      chain_support: ["monad"],
    });
  } catch (error) {
    log.error("Agent handler error:", error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    res.status(500).json({
      error: `Failed to process request: ${errorMessage}`,
      timestamp: new Date().toISOString(),
    });
  }
};

app.post("/agent", agentHandler);

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
  log.info(`Server running on http://localhost:${PORT}`);
});