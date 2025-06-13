"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const openai_1 = require("@langchain/openai");
const langgraph_1 = require("@langchain/langgraph");
const messages_1 = require("@langchain/core/messages");
const prebuilt_1 = require("@langchain/langgraph/prebuilt");
const zod_1 = require("zod");
const tools_1 = require("@langchain/core/tools");
const ethers_1 = require("ethers");
const dotenv = __importStar(require("dotenv"));
const express_1 = __importDefault(require("express"));
const body_parser_1 = __importDefault(require("body-parser"));
const axios_1 = __importDefault(require("axios"));
const tslog_1 = require("tslog");
const cors_1 = __importDefault(require("cors"));
dotenv.config();
// Logger setup
const log = new tslog_1.Logger({ name: "NexisAgent", minLevel: 0, prettyLogTemplate: "{{yyyy}}.{{mm}}.{{dd}} {{hh}}:{{MM}}:{{ss}} {{logLevelName}} {{name}} - " });
// Environment variables
const OPENAI_API_KEY = process.env.OPENAI_API_KEY || "";
const COINGECKO_API_KEY = process.env.COINGECKO_API_KEY || "";
const MONAD_RPC_URL = process.env.MONAD_RPC_URL || "https://testnet-rpc.monad.xyz";
const MONAD_EXPLORER_URL = "https://monad-testnet.socialscan.io";
const MONAD_FAUCET_URL = "https://testnet.monad.xyz/";
// Validate environment variables
const validateEnvVars = async () => {
    const errors = [];
    if (!OPENAI_API_KEY)
        errors.push("OPENAI_API_KEY is not set in .env file");
    if (!COINGECKO_API_KEY)
        log.warn("COINGECKO_API_KEY not set. Token price queries may be limited.");
    if (!MONAD_RPC_URL)
        errors.push("MONAD_RPC_URL is not set.");
    const testRpcConnection = async (url, chain) => {
        try {
            const provider = new ethers_1.ethers.JsonRpcProvider(url);
            await provider.getBlockNumber();
            log.info(`RPC connection successful for ${chain}: ${url}`);
        }
        catch (error) {
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
const llm = new openai_1.ChatOpenAI({
    model: "gpt-4o-mini",
    apiKey: OPENAI_API_KEY,
    temperature: 0,
});
// Blockchain tools
class BlockchainTools {
    provider;
    wallet = null;
    constructor() {
        this.provider = new ethers_1.ethers.JsonRpcProvider(MONAD_RPC_URL);
        log.info("Provider initialized for Monad Testnet");
    }
    getProvider() {
        return this.provider;
    }
    getWallet() {
        return this.wallet;
    }
    setWallet(wallet) {
        this.wallet = wallet;
        log.info(`Wallet set for Monad Testnet`);
    }
    clearWallet() {
        this.wallet = null;
        log.info("Wallet cleared from memory");
    }
}
// Define tools
class SetWalletTool extends tools_1.StructuredTool {
    tools;
    schema = zod_1.z.object({
        privateKey: zod_1.z.string().describe("The private key to set the wallet"),
    });
    name = "setWallet";
    description = "Set the wallet using a private key for Monad Testnet. Required for transactions.";
    constructor(tools) {
        super();
        this.tools = tools;
    }
    async _call({ privateKey }) {
        try {
            const wallet = new ethers_1.ethers.Wallet(privateKey, this.tools.getProvider());
            this.tools.setWallet(wallet);
            log.info(`Wallet set to address: ${wallet.address}`);
            return `✅ Wallet set for Monad Testnet at address: ${wallet.address}. You can now perform transactions.`;
        }
        catch (error) {
            log.error("SetWalletTool error:", error);
            throw new Error(`Failed to set wallet: ${error instanceof Error ? error.message : String(error)}`);
        }
    }
}
class DisconnectWalletTool extends tools_1.StructuredTool {
    tools;
    schema = zod_1.z.object({});
    name = "disconnectWallet";
    description = "Disconnect the current wallet and clear it from memory";
    constructor(tools) {
        super();
        this.tools = tools;
    }
    async _call() {
        this.tools.clearWallet();
        return "🔌 Wallet disconnected successfully";
    }
}
class GetWalletAddressTool extends tools_1.StructuredTool {
    tools;
    schema = zod_1.z.object({});
    name = "getWalletAddress";
    description = "Get the current wallet address for Monad Testnet";
    constructor(tools) {
        super();
        this.tools = tools;
    }
    async _call() {
        const wallet = this.tools.getWallet();
        if (!wallet)
            return "🚫 No wallet set. Please set a wallet using 'setWallet <privateKey>' first.";
        return `📍 Monad Testnet wallet address: ${wallet.address}`;
    }
}
class GetBalanceTool extends tools_1.StructuredTool {
    tools;
    schema = zod_1.z.object({});
    name = "getBalance";
    description = "Get the MONAD balance for the connected wallet";
    constructor(tools) {
        super();
        this.tools = tools;
    }
    async _call() {
        const wallet = this.tools.getWallet();
        if (!wallet)
            return "🚫 No wallet set. Please set a wallet using 'setWallet <privateKey>' first.";
        const balances = [];
        try {
            const monadBalance = await this.tools.getProvider().getBalance(wallet.address);
            balances.push(`💰 MONAD Balance: ${ethers_1.ethers.formatEther(monadBalance)} MONAD`);
        }
        catch (error) {
            log.error("Error fetching MONAD balance:", error);
            balances.push("❌ Unable to fetch MONAD balance");
        }
        return balances.length > 0 ? `📊 **Monad Testnet Portfolio**:\n${balances.join("\n")}` : "No balances available.";
    }
}
class TransferTokensTool extends tools_1.StructuredTool {
    tools;
    schema = zod_1.z.object({
        to: zod_1.z.string().describe("The recipient address"),
        amount: zod_1.z.string().describe("The amount of MONAD to transfer"),
    });
    name = "transferTokens";
    description = "Transfer MONAD tokens to an address on Monad Testnet";
    constructor(tools) {
        super();
        this.tools = tools;
    }
    async _call({ to, amount }) {
        const wallet = this.tools.getWallet();
        if (!wallet)
            return "🚫 No wallet set. Please set a wallet using 'setWallet <privateKey>' first.";
        if (!ethers_1.ethers.isAddress(to))
            return `❌ Invalid recipient address: ${to}`;
        if (isNaN(Number(amount)) || Number(amount) <= 0)
            return `❌ Invalid amount: ${amount}`;
        try {
            const tx = { to, value: ethers_1.ethers.parseEther(amount) };
            const txResponse = await wallet.sendTransaction(tx);
            const receipt = await txResponse.wait();
            log.info(`Transfer: ${amount} MONAD to ${to}, Tx: ${txResponse.hash}`);
            return `✅ Transferred ${amount} MONAD to ${to}. [View Transaction](${MONAD_EXPLORER_URL}/tx/${txResponse.hash})`;
        }
        catch (error) {
            log.error("TransferTokensTool error:", error);
            return `❌ Failed to transfer tokens: ${error instanceof Error ? error.message : String(error)}`;
        }
    }
}
class GetTokenPriceTool extends tools_1.StructuredTool {
    schema = zod_1.z.object({
        token: zod_1.z.string().describe("Token ticker (e.g., MONAD, ETH, BNB)"),
    });
    name = "getTokenPrice";
    description = "Get real-time token price from CoinGecko";
    async _call({ token }) {
        try {
            const tokenMap = {
                ETH: "ethereum",
                BNB: "binancecoin",
                MONAD: "monad",
            };
            const coinId = tokenMap[token.toUpperCase()] || token.toLowerCase();
            log.info(`Fetching price for token: ${token}, coinId: ${coinId}`);
            const response = await axios_1.default.get(`https://api.coingecko.com/api/v3/simple/price?ids=${coinId}&vs_currencies=usd`, { headers: COINGECKO_API_KEY ? { "x-cg-api-key": COINGECKO_API_KEY } : {}, timeout: 10000 });
            const price = response.data[coinId]?.usd;
            if (!price) {
                log.warn(`Price not found for ${token}`);
                return `❌ Price not found for ${token}`;
            }
            return `💰 **${token.toUpperCase()} Price**: $${price.toLocaleString()} USD`;
        }
        catch (error) {
            log.error("GetTokenPriceTool error:", error);
            return `❌ Failed to fetch price for ${token}: ${error instanceof Error ? error.message : String(error)}`;
        }
    }
}
class GetFaucetTokensTool extends tools_1.StructuredTool {
    schema = zod_1.z.object({
        address: zod_1.z.string().describe("The wallet address to receive testnet MON tokens"),
    });
    name = "getFaucetTokens";
    description = "Request testnet MON tokens from the Monad faucet";
    async _call({ address }) {
        try {
            if (!ethers_1.ethers.isAddress(address))
                return "❌ Invalid Ethereum address provided.";
            return `💧 To get testnet MON tokens for ${address}, visit ${MONAD_FAUCET_URL}, connect your wallet, paste your address (${address}), and click 'Get Testnet MON'. Tokens are available every 12 hours based on eligibility.`;
        }
        catch (error) {
            log.error("GetFaucetTokensTool error:", error);
            return `❌ Failed to process faucet request: ${error instanceof Error ? error.message : String(error)}`;
        }
    }
}
class HelpTool extends tools_1.StructuredTool {
    schema = zod_1.z.object({});
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
const toolNode = new prebuilt_1.ToolNode(tools);
const modelWithTools = llm.bindTools(tools);
// Agent logic
async function callAgent(state) {
    const systemMessage = new messages_1.SystemMessage(`You are Nexis, a friendly AI-powered Web3 assistant specializing in the Monad Testnet and general blockchain queries. Your capabilities include:

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
    Make blockchain interactions simple, secure, and accessible.`);
    const messagesWithSystem = [systemMessage, ...state.messages];
    const response = await modelWithTools.invoke(messagesWithSystem);
    return { messages: [response] };
}
function shouldContinue(state) {
    const lastMessage = state.messages[state.messages.length - 1];
    if ("tool_calls" in lastMessage && Array.isArray(lastMessage.tool_calls) && lastMessage.tool_calls.length > 0) {
        return "tools";
    }
    return langgraph_1.END;
}
// Define workflow
const workflow = new langgraph_1.StateGraph({
    channels: {
        messages: {
            reducer: (x, y) => (x ?? []).concat(y ?? []),
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
const app = (0, express_1.default)();
app.use((0, cors_1.default)({
    origin: ["https://nexis-mocha.vercel.app", "http://localhost:5173"], // Allow frontend and local dev
    methods: ["GET", "POST", "OPTIONS"],
    allowedHeaders: ["Content-Type"],
}));
app.use(body_parser_1.default.json());
// Root endpoint
app.get("/", (req, res) => {
    res.json({
        message: "Nexis Agent backend running",
        version: "1.0.0",
        supported_chains: ["monad"],
        timestamp: new Date().toISOString(),
    });
});
// Agent handler
const agentHandler = async (req, res) => {
    try {
        log.info(`Handling ${req.method} request to ${req.url}`);
        const { input, privateKey } = req.body;
        if (!input) {
            log.warn("Input is missing in request body");
            res.status(400).json({ error: "Input is required", timestamp: new Date().toISOString() });
            return;
        }
        const messages = [];
        if (privateKey) {
            messages.push(new messages_1.HumanMessage(`setWallet ${privateKey}`));
        }
        messages.push(new messages_1.HumanMessage(input));
        log.info(`Processing request: ${input}`);
        const result = await agent.invoke({ messages });
        const lastMessage = result.messages[result.messages.length - 1];
        res.status(200).json({
            response: lastMessage.content,
            tool_calls: "tool_calls" in lastMessage ? lastMessage.tool_calls : [],
            timestamp: new Date().toISOString(),
            chain_support: ["monad"],
        });
    }
    catch (error) {
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
