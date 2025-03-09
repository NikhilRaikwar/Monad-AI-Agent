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
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
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
const cheerio = __importStar(require("cheerio"));
const tslog_1 = require("tslog");
dotenv.config();
// Environment variables
const OPENAI_API_KEY = process.env.OPENAI_API_KEY || "";
const COINGECKO_API_KEY = process.env.COINGECKO_API_KEY || "";
const DEXSCREENER_API_KEY = process.env.DEXSCREENER_API_KEY || "";
const MONAD_RPC_URL = process.env.MONAD_RPC_URL || "https://testnet-rpc.monad.xyz";
const MONAD_EXPLORER_URL = "https://monad-testnet.socialscan.io";
const MONAD_FAUCET_URL = "https://testnet.monad.xyz/";
// Logger setup
const log = new tslog_1.Logger({ name: "MonadAgent" });
// Initialize OpenAI model
const llm = new openai_1.ChatOpenAI({
    model: "gpt-4o-mini",
    apiKey: OPENAI_API_KEY,
    temperature: 0,
});
// Blockchain tools
class BlockchainTools {
    constructor() {
        this.wallet = null;
        this.provider = new ethers_1.ethers.JsonRpcProvider(MONAD_RPC_URL);
    }
    getProvider() {
        return this.provider;
    }
    getWallet() {
        return this.wallet;
    }
    setWallet(wallet) {
        this.wallet = wallet;
    }
}
// Simple ERC-20 Token ABI and Bytecode (minimal example)
const TOKEN_ABI = [
    {
        "inputs": [
            {
                "internalType": "string",
                "name": "name",
                "type": "string"
            },
            {
                "internalType": "string",
                "name": "symbol",
                "type": "string"
            },
            {
                "internalType": "uint256",
                "name": "initialSupply",
                "type": "uint256"
            }
        ],
        "stateMutability": "nonpayable",
        "type": "constructor"
    },
    {
        "inputs": [
            {
                "internalType": "address",
                "name": "spender",
                "type": "address"
            },
            {
                "internalType": "uint256",
                "name": "allowance",
                "type": "uint256"
            },
            {
                "internalType": "uint256",
                "name": "needed",
                "type": "uint256"
            }
        ],
        "name": "ERC20InsufficientAllowance",
        "type": "error"
    },
    {
        "inputs": [
            {
                "internalType": "address",
                "name": "sender",
                "type": "address"
            },
            {
                "internalType": "uint256",
                "name": "balance",
                "type": "uint256"
            },
            {
                "internalType": "uint256",
                "name": "needed",
                "type": "uint256"
            }
        ],
        "name": "ERC20InsufficientBalance",
        "type": "error"
    },
    {
        "inputs": [
            {
                "internalType": "address",
                "name": "approver",
                "type": "address"
            }
        ],
        "name": "ERC20InvalidApprover",
        "type": "error"
    },
    {
        "inputs": [
            {
                "internalType": "address",
                "name": "receiver",
                "type": "address"
            }
        ],
        "name": "ERC20InvalidReceiver",
        "type": "error"
    },
    {
        "inputs": [
            {
                "internalType": "address",
                "name": "sender",
                "type": "address"
            }
        ],
        "name": "ERC20InvalidSender",
        "type": "error"
    },
    {
        "inputs": [
            {
                "internalType": "address",
                "name": "spender",
                "type": "address"
            }
        ],
        "name": "ERC20InvalidSpender",
        "type": "error"
    },
    {
        "anonymous": false,
        "inputs": [
            {
                "indexed": true,
                "internalType": "address",
                "name": "owner",
                "type": "address"
            },
            {
                "indexed": true,
                "internalType": "address",
                "name": "spender",
                "type": "address"
            },
            {
                "indexed": false,
                "internalType": "uint256",
                "name": "value",
                "type": "uint256"
            }
        ],
        "name": "Approval",
        "type": "event"
    },
    {
        "anonymous": false,
        "inputs": [
            {
                "indexed": true,
                "internalType": "address",
                "name": "from",
                "type": "address"
            },
            {
                "indexed": true,
                "internalType": "address",
                "name": "to",
                "type": "address"
            },
            {
                "indexed": false,
                "internalType": "uint256",
                "name": "value",
                "type": "uint256"
            }
        ],
        "name": "Transfer",
        "type": "event"
    },
    {
        "inputs": [
            {
                "internalType": "address",
                "name": "owner",
                "type": "address"
            },
            {
                "internalType": "address",
                "name": "spender",
                "type": "address"
            }
        ],
        "name": "allowance",
        "outputs": [
            {
                "internalType": "uint256",
                "name": "",
                "type": "uint256"
            }
        ],
        "stateMutability": "view",
        "type": "function"
    },
    {
        "inputs": [
            {
                "internalType": "address",
                "name": "spender",
                "type": "address"
            },
            {
                "internalType": "uint256",
                "name": "value",
                "type": "uint256"
            }
        ],
        "name": "approve",
        "outputs": [
            {
                "internalType": "bool",
                "name": "",
                "type": "bool"
            }
        ],
        "stateMutability": "nonpayable",
        "type": "function"
    },
    {
        "inputs": [
            {
                "internalType": "address",
                "name": "account",
                "type": "address"
            }
        ],
        "name": "balanceOf",
        "outputs": [
            {
                "internalType": "uint256",
                "name": "",
                "type": "uint256"
            }
        ],
        "stateMutability": "view",
        "type": "function"
    },
    {
        "inputs": [],
        "name": "decimals",
        "outputs": [
            {
                "internalType": "uint8",
                "name": "",
                "type": "uint8"
            }
        ],
        "stateMutability": "view",
        "type": "function"
    },
    {
        "inputs": [],
        "name": "name",
        "outputs": [
            {
                "internalType": "string",
                "name": "",
                "type": "string"
            }
        ],
        "stateMutability": "view",
        "type": "function"
    },
    {
        "inputs": [],
        "name": "symbol",
        "outputs": [
            {
                "internalType": "string",
                "name": "",
                "type": "string"
            }
        ],
        "stateMutability": "view",
        "type": "function"
    },
    {
        "inputs": [],
        "name": "totalSupply",
        "outputs": [
            {
                "internalType": "uint256",
                "name": "",
                "type": "uint256"
            }
        ],
        "stateMutability": "view",
        "type": "function"
    },
    {
        "inputs": [
            {
                "internalType": "address",
                "name": "to",
                "type": "address"
            },
            {
                "internalType": "uint256",
                "name": "value",
                "type": "uint256"
            }
        ],
        "name": "transfer",
        "outputs": [
            {
                "internalType": "bool",
                "name": "",
                "type": "bool"
            }
        ],
        "stateMutability": "nonpayable",
        "type": "function"
    },
    {
        "inputs": [
            {
                "internalType": "address",
                "name": "from",
                "type": "address"
            },
            {
                "internalType": "address",
                "name": "to",
                "type": "address"
            },
            {
                "internalType": "uint256",
                "name": "value",
                "type": "uint256"
            }
        ],
        "name": "transferFrom",
        "outputs": [
            {
                "internalType": "bool",
                "name": "",
                "type": "bool"
            }
        ],
        "stateMutability": "nonpayable",
        "type": "function"
    }
];
const TOKEN_BYTECODE = "0x608060405234801561000f575f80fd5b5060405161173e38038061173e8339818101604052810190610031919061049e565b82828160039081610042919061072a565b508060049081610052919061072a565b50505061007833670de0b6b3a76400008361006d9190610826565b61008060201b60201c565b50505061094f565b5f73ffffffffffffffffffffffffffffffffffffffff168273ffffffffffffffffffffffffffffffffffffffff16036100f0575f6040517fec442f050000000000000000000000000000000000000000000000000000000081526004016100e791906108a6565b60405180910390fd5b6101015f838361010560201b60201c565b5050565b5f73ffffffffffffffffffffffffffffffffffffffff168373ffffffffffffffffffffffffffffffffffffffff1603610155578060025f82825461014991906108bf565b92505081905550610223565b5f805f8573ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff1681526020019081526020015f20549050818110156101de578381836040517fe450d38c0000000000000000000000000000000000000000000000000000000081526004016101d593929190610901565b60405180910390fd5b8181035f808673ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff1681526020019081526020015f2081905550505b5f73ffffffffffffffffffffffffffffffffffffffff168273ffffffffffffffffffffffffffffffffffffffff160361026a578060025f82825403925050819055506102b4565b805f808473ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff1681526020019081526020015f205f82825401925050819055505b8173ffffffffffffffffffffffffffffffffffffffff168373ffffffffffffffffffffffffffffffffffffffff167fddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef836040516103119190610936565b60405180910390a3505050565b5f604051905090565b5f80fd5b5f80fd5b5f80fd5b5f80fd5b5f601f19601f8301169050919050565b7f4e487b71000000000000000000000000000000000000000000000000000000005f52604160045260245ffd5b61037d82610337565b810181811067ffffffffffffffff8211171561039c5761039b610347565b5b80604052505050565b5f6103ae61031e565b90506103ba8282610374565b919050565b5f67ffffffffffffffff8211156103d9576103d8610347565b5b6103e282610337565b9050602081019050919050565b8281835e5f83830152505050565b5f61040f61040a846103bf565b6103a5565b90508281526020810184848401111561042b5761042a610333565b5b6104368482856103ef565b509392505050565b5f82601f8301126104525761045161032f565b5b81516104628482602086016103fd565b91505092915050565b5f819050919050565b61047d8161046b565b8114610487575f80fd5b50565b5f8151905061049881610474565b92915050565b5f805f606084860312156104b5576104b4610327565b5b5f84015167ffffffffffffffff8111156104d2576104d161032b565b5b6104de8682870161043e565b935050602084015167ffffffffffffffff8111156104ff576104fe61032b565b5b61050b8682870161043e565b925050604061051c8682870161048a565b9150509250925092565b5f81519050919050565b7f4e487b71000000000000000000000000000000000000000000000000000000005f52602260045260245ffd5b5f600282049050600182168061057457607f821691505b60208210810361058757610586610530565b5b50919050565b5f819050815f5260205f209050919050565b5f6020601f8301049050919050565b5f82821b905092915050565b5f600883026105e97fffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff826105ae565b6105f386836105ae565b95508019841693508086168417925050509392505050565b5f819050919050565b5f61062e6106296106248461046b565b61060b565b61046b565b9050919050565b5f819050919050565b61064783610614565b61065b61065382610635565b8484546105ba565b825550505050565b5f90565b61066f610663565b61067a81848461063e565b505050565b5b8181101561069d576106925f82610667565b600181019050610680565b5050565b601f8211156106e2576106b38161058d565b6106bc8461059f565b810160208510156106cb578190505b6106df6106d78561059f565b83018261067f565b50505b505050565b5f82821c905092915050565b5f6107025f19846008026106e7565b1980831691505092915050565b5f61071a83836106f3565b9150826002028217905092915050565b61073382610526565b67ffffffffffffffff81111561074c5761074b610347565b5b610756825461055d565b6107618282856106a1565b5f60209050601f831160018114610792575f8415610780578287015190505b61078a858261070f565b8655506107f1565b601f1984166107a08661058d565b5f5b828110156107c7578489015182556001820191506020850194506020810190506107a2565b868310156107e457848901516107e0601f8916826106f3565b8355505b6001600288020188555050505b505050505050565b7f4e487b71000000000000000000000000000000000000000000000000000000005f52601160045260245ffd5b5f6108308261046b565b915061083b8361046b565b92508282026108498161046b565b915082820484148315176108605761085f6107f9565b5b5092915050565b5f73ffffffffffffffffffffffffffffffffffffffff82169050919050565b5f61089082610867565b9050919050565b6108a081610886565b82525050565b5f6020820190506108b95f830184610897565b92915050565b5f6108c98261046b565b91506108d48361046b565b92508282019050808211156108ec576108eb6107f9565b5b92915050565b6108fb8161046b565b82525050565b5f6060820190506109145f830186610897565b61092160208301856108f2565b61092e60408301846108f2565b949350505050565b5f6020820190506109495f8301846108f2565b92915050565b610de28061095c5f395ff3fe608060405234801561000f575f80fd5b5060043610610091575f3560e01c8063313ce56711610064578063313ce5671461013157806370a082311461014f57806395d89b411461017f578063a9059cbb1461019d578063dd62ed3e146101cd57610091565b806306fdde0314610095578063095ea7b3146100b357806318160ddd146100e357806323b872dd14610101575b5f80fd5b61009d6101fd565b6040516100aa9190610a5b565b60405180910390f35b6100cd60048036038101906100c89190610b0c565b61028d565b6040516100da9190610b64565b60405180910390f35b6100eb6102af565b6040516100f89190610b8c565b60405180910390f35b61011b60048036038101906101169190610ba5565b6102b8565b6040516101289190610b64565b60405180910390f35b6101396102e6565b6040516101469190610c10565b60405180910390f35b61016960048036038101906101649190610c29565b6102ee565b6040516101769190610b8c565b60405180910390f35b610187610333565b6040516101949190610a5b565b60405180910390f35b6101b760048036038101906101b29190610b0c565b6103c3565b6040516101c49190610b64565b60405180910390f35b6101e760048036038101906101e29190610c54565b6103e5565b6040516101f49190610b8c565b60405180910390f35b60606003805461020c90610cbf565b80601f016020809104026020016040519081016040528092919081815260200182805461023890610cbf565b80156102835780601f1061025a57610100808354040283529160200191610283565b820191905f5260205f20905b81548152906001019060200180831161026657829003601f168201915b5050505050905090565b5f80610297610467565b90506102a481858561046e565b600191505092915050565b5f600254905090565b5f806102c2610467565b90506102cf858285610480565b6102da858585610513565b60019150509392505050565b5f6012905090565b5f805f8373ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff1681526020019081526020015f20549050919050565b60606004805461034290610cbf565b80601f016020809104026020016040519081016040528092919081815260200182805461036e90610cbf565b80156103b95780601f10610390576101008083540402835291602001916103b9565b820191905f5260205f20905b81548152906001019060200180831161039c57829003601f168201915b5050505050905090565b5f806103cd610467565b90506103da818585610513565b600191505092915050565b5f60015f8473ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff1681526020019081526020015f205f8373ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff1681526020019081526020015f2054905092915050565b5f33905090565b61047b8383836001610603565b505050565b5f61048b84846103e5565b90507fffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff81101561050d57818110156104fe578281836040517ffb8f41b20000000000000000000000000000000000000000000000000000000081526004016104f593929190610cfe565b60405180910390fd5b61050c84848484035f610603565b5b50505050565b5f73ffffffffffffffffffffffffffffffffffffffff168373ffffffffffffffffffffffffffffffffffffffff1603610583575f6040517f96c6fd1e00000000000000000000000000000000000000000000000000000000815260040161057a9190610d33565b60405180910390fd5b5f73ffffffffffffffffffffffffffffffffffffffff168273ffffffffffffffffffffffffffffffffffffffff16036105f3575f6040517fec442f050000000000000000000000000000000000000000000000000000000081526004016105ea9190610d33565b60405180910390fd5b6105fe8383836107d2565b505050565b5f73ffffffffffffffffffffffffffffffffffffffff168473ffffffffffffffffffffffffffffffffffffffff1603610673575f6040517fe602df0500000000000000000000000000000000000000000000000000000000815260040161066a9190610d33565b60405180910390fd5b5f73ffffffffffffffffffffffffffffffffffffffff168373ffffffffffffffffffffffffffffffffffffffff16036106e3575f6040517f94280d620000000000000000000000000000000000000000000000000000000081526004016106da9190610d33565b60405180910390fd5b8160015f8673ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff1681526020019081526020015f205f8573ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff1681526020019081526020015f208190555080156107cc578273ffffffffffffffffffffffffffffffffffffffff168473ffffffffffffffffffffffffffffffffffffffff167f8c5be1e5ebec7d5bd14f71427d1e84f3dd0314c0f7b2291e5b200ac8c7c3b925846040516107c39190610b8c565b60405180910390a35b50505050565b5f73ffffffffffffffffffffffffffffffffffffffff168373ffffffffffffffffffffffffffffffffffffffff1603610822578060025f8282546108169190610d79565b925050819055506108f0565b5f805f8573ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff1681526020019081526020015f20549050818110156108ab578381836040517fe450d38c0000000000000000000000000000000000000000000000000000000081526004016108a293929190610cfe565b60405180910390fd5b8181035f808673ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff1681526020019081526020015f2081905550505b5f73ffffffffffffffffffffffffffffffffffffffff168273ffffffffffffffffffffffffffffffffffffffff1603610937578060025f8282540392505081905550610981565b805f808473ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff1681526020019081526020015f205f82825401925050819055505b8173ffffffffffffffffffffffffffffffffffffffff168373ffffffffffffffffffffffffffffffffffffffff167fddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef836040516109de9190610b8c565b60405180910390a3505050565b5f81519050919050565b5f82825260208201905092915050565b8281835e5f83830152505050565b5f601f19601f8301169050919050565b5f610a2d826109eb565b610a3781856109f5565b9350610a47818560208601610a05565b610a5081610a13565b840191505092915050565b5f6020820190508181035f830152610a738184610a23565b905092915050565b5f80fd5b5f73ffffffffffffffffffffffffffffffffffffffff82169050919050565b5f610aa882610a7f565b9050919050565b610ab881610a9e565b8114610ac2575f80fd5b50565b5f81359050610ad381610aaf565b92915050565b5f819050919050565b610aeb81610ad9565b8114610af5575f80fd5b50565b5f81359050610b0681610ae2565b92915050565b5f8060408385031215610b2257610b21610a7b565b5b5f610b2f85828601610ac5565b9250506020610b4085828601610af8565b9150509250929050565b5f8115159050919050565b610b5e81610b4a565b82525050565b5f602082019050610b775f830184610b55565b92915050565b610b8681610ad9565b82525050565b5f602082019050610b9f5f830184610b7d565b92915050565b5f805f60608486031215610bbc57610bbb610a7b565b5b5f610bc986828701610ac5565b9350506020610bda86828701610ac5565b9250506040610beb86828701610af8565b9150509250925092565b5f60ff82169050919050565b610c0a81610bf5565b82525050565b5f602082019050610c235f830184610c01565b92915050565b5f60208284031215610c3e57610c3d610a7b565b5b5f610c4b84828501610ac5565b91505092915050565b5f8060408385031215610c6a57610c69610a7b565b5b5f610c7785828601610ac5565b9250506020610c8885828601610ac5565b9150509250929050565b7f4e487b71000000000000000000000000000000000000000000000000000000005f52602260045260245ffd5b5f6002820490506001821680610cd657607f821691505b602082108103610ce957610ce8610c92565b5b50919050565b610cf881610a9e565b82525050565b5f606082019050610d115f830186610cef565b610d1e6020830185610b7d565b610d2b6040830184610b7d565b949350505050565b5f602082019050610d465f830184610cef565b92915050565b7f4e487b71000000000000000000000000000000000000000000000000000000005f52601160045260245ffd5b5f610d8382610ad9565b9150610d8e83610ad9565b9250828201905080821115610da657610da5610d4c565b5b9291505056fea2646970667358221220587c9cc22e5e0414dc3178b5068b56880c24fee15dec9ab4c797d5c0eff1849264736f6c634300081a0033"; // Replace with actual compiled bytecode
// Define tools as StructuredTool
class SetWalletTool extends tools_1.StructuredTool {
    constructor(tools) {
        super();
        this.tools = tools;
        this.schema = zod_1.z.object({
            privateKey: zod_1.z.string().describe("The private key to set the wallet"),
        });
        this.name = "setWallet";
        this.description = "Set the wallet using a private key";
    }
    _call(_a) {
        return __awaiter(this, arguments, void 0, function* ({ privateKey }) {
            try {
                const wallet = new ethers_1.ethers.Wallet(privateKey, this.tools.getProvider());
                this.tools.setWallet(wallet);
                log.info(`Wallet set to address: ${wallet.address}`);
                return `Wallet set to address: ${wallet.address}`;
            }
            catch (error) {
                log.error("SetWalletTool error:", error);
                throw new Error(`Failed to set wallet: ${error instanceof Error ? error.message : String(error)}`);
            }
        });
    }
}
class GetWalletAddressTool extends tools_1.StructuredTool {
    constructor(tools) {
        super();
        this.tools = tools;
        this.schema = zod_1.z.object({});
        this.name = "getWalletAddress";
        this.description = "Get the current wallet address";
    }
    _call() {
        return __awaiter(this, void 0, void 0, function* () {
            const wallet = this.tools.getWallet();
            if (!wallet)
                return "No wallet set. Please provide a private key.";
            return wallet.address;
        });
    }
}
class GetBalanceTool extends tools_1.StructuredTool {
    constructor(tools) {
        super();
        this.tools = tools;
        this.schema = zod_1.z.object({});
        this.name = "getBalance";
        this.description = "Get the MONAD token balance of the wallet";
    }
    _call() {
        return __awaiter(this, void 0, void 0, function* () {
            const wallet = this.tools.getWallet();
            if (!wallet)
                return "No wallet set.";
            const balance = yield this.tools.getProvider().getBalance(wallet.address);
            return `Balance: ${ethers_1.ethers.formatEther(balance)} MONAD`;
        });
    }
}
class TransferTokensTool extends tools_1.StructuredTool {
    constructor(tools) {
        super();
        this.tools = tools;
        this.schema = zod_1.z.object({
            to: zod_1.z.string().describe("The recipient address"),
            amount: zod_1.z.string().describe("The amount of tokens to transfer"),
        });
        this.name = "transferTokens";
        this.description = "Transfer MONAD tokens to an address";
    }
    _call(_a) {
        return __awaiter(this, arguments, void 0, function* ({ to, amount }) {
            const wallet = this.tools.getWallet();
            if (!wallet)
                return "No wallet set.";
            try {
                const tx = { to, value: ethers_1.ethers.parseEther(amount) };
                const txResponse = yield wallet.sendTransaction(tx);
                yield txResponse.wait();
                log.info(`Transfer: ${amount} MONAD to ${to}, Tx: ${txResponse.hash}`);
                return `Transferred ${amount} MONAD to ${to}. Tx: ${MONAD_EXPLORER_URL}/tx/${txResponse.hash}`;
            }
            catch (error) {
                log.error("TransferTokensTool error:", error);
                throw new Error(`Failed to transfer tokens: ${error instanceof Error ? error.message : String(error)}`);
            }
        });
    }
}
class SignMessageTool extends tools_1.StructuredTool {
    constructor(tools) {
        super();
        this.tools = tools;
        this.schema = zod_1.z.object({
            message: zod_1.z.string().describe("The message to sign"),
        });
        this.name = "signMessage";
        this.description = "Sign a message with the wallet";
    }
    _call(_a) {
        return __awaiter(this, arguments, void 0, function* ({ message }) {
            const wallet = this.tools.getWallet();
            if (!wallet)
                return "No wallet set.";
            try {
                const signature = yield wallet.signMessage(message);
                return `Message signed: ${signature}`;
            }
            catch (error) {
                log.error("SignMessageTool error:", error);
                throw new Error(`Failed to sign message: ${error instanceof Error ? error.message : String(error)}`);
            }
        });
    }
}
class GetTransactionHistoryTool extends tools_1.StructuredTool {
    constructor(tools) {
        super();
        this.tools = tools;
        this.schema = zod_1.z.object({
            count: zod_1.z.number().optional().default(5).describe("Number of transactions to fetch"),
        });
        this.name = "getTransactionHistory";
        this.description = "Get recent transaction history with explorer links";
    }
    _call(_a) {
        return __awaiter(this, arguments, void 0, function* ({ count }) {
            const wallet = this.tools.getWallet();
            if (!wallet)
                return "No wallet set.";
            const provider = this.tools.getProvider();
            const blockNumber = yield provider.getBlockNumber();
            const fromBlock = Math.max(blockNumber - 99, 0);
            const filter = { fromBlock, toBlock: blockNumber, address: wallet.address };
            try {
                const logs = yield provider.getLogs(filter);
                const recentTxs = logs.slice(0, count).map((log) => ({
                    hash: `${MONAD_EXPLORER_URL}/tx/${log.transactionHash}`,
                    blockNumber: log.blockNumber,
                    data: log.data,
                }));
                return `Recent ${count} transactions:\n${JSON.stringify(recentTxs, null, 2)}`;
            }
            catch (error) {
                log.error("GetTransactionHistoryTool error:", error);
                return `Failed to fetch transaction history: ${error instanceof Error ? error.message : String(error)}`;
            }
        });
    }
}
class GetGasPriceTool extends tools_1.StructuredTool {
    constructor(tools) {
        super();
        this.tools = tools;
        this.schema = zod_1.z.object({});
        this.name = "getGasPrice";
        this.description = "Estimate current gas price";
    }
    _call() {
        return __awaiter(this, void 0, void 0, function* () {
            const feeData = yield this.tools.getProvider().getFeeData();
            const gasPrice = feeData.gasPrice;
            if (!gasPrice)
                return "Unable to fetch gas price.";
            return `Current gas price: ${ethers_1.ethers.formatUnits(gasPrice, "gwei")} gwei`;
        });
    }
}
class GetTokenPriceTool extends tools_1.StructuredTool {
    constructor() {
        super(...arguments);
        this.schema = zod_1.z.object({
            token: zod_1.z.string().describe("Token ticker (e.g., MONAD)"),
        });
        this.name = "getTokenPrice";
        this.description = "Get real-time token price from CoinGecko";
    }
    _call(_a) {
        return __awaiter(this, arguments, void 0, function* ({ token }) {
            var _b;
            try {
                const response = yield axios_1.default.get(`https://api.coingecko.com/api/v3/simple/price?ids=${token.toLowerCase()}&vs_currencies=usd`, { headers: { "x-cg-api-key": COINGECKO_API_KEY } });
                const price = (_b = response.data[token.toLowerCase()]) === null || _b === void 0 ? void 0 : _b.usd;
                if (!price)
                    return `Price not found for ${token}`;
                return `Price of ${token}: $${price} USD`;
            }
            catch (error) {
                log.error("GetTokenPriceTool error:", error);
                throw new Error(`Failed to fetch price: ${error instanceof Error ? error.message : String(error)}`);
            }
        });
    }
}
class GetTrendingTokensTool extends tools_1.StructuredTool {
    constructor() {
        super(...arguments);
        this.schema = zod_1.z.object({});
        this.name = "getTrendingTokens";
        this.description = "Get trending tokens from Monad Testnet explorer";
    }
    _call() {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                if (!cheerio)
                    throw new Error("Cheerio module is not available.");
                const response = yield axios_1.default.get(`${MONAD_EXPLORER_URL}/tokens`, {
                    headers: { "User-Agent": "Mozilla/5.0" },
                });
                const $ = cheerio.load(response.data);
                const tokens = [];
                $("table tbody tr").each((_, element) => {
                    const tokenName = $(element).find("td:nth-child(1)").text().trim();
                    const price = $(element).find("td:nth-child(2)").text().trim();
                    if (tokenName && price)
                        tokens.push({ token: tokenName, price });
                });
                if (tokens.length === 0)
                    return "No token data found on the explorer.";
                return `Trending tokens from Monad Testnet:\n${JSON.stringify(tokens.slice(0, 5), null, 2)}`;
            }
            catch (error) {
                log.error("GetTrendingTokensTool error:", error);
                return `Failed to fetch trending tokens: ${error instanceof Error ? error.message : String(error)}`;
            }
        });
    }
}
// New Tool: Create Token on Monad Testnet
class CreateTokenTool extends tools_1.StructuredTool {
    constructor(tools) {
        super();
        this.tools = tools;
        this.schema = zod_1.z.object({
            name: zod_1.z.string().describe("The name of the token"),
            symbol: zod_1.z.string().describe("The symbol of the token"),
            totalSupply: zod_1.z.string().describe("The total supply of the token (in whole units, e.g., 1000 for 1000 tokens)"),
        });
        this.name = "createToken";
        this.description = "Create a new token on the Monad Testnet";
    }
    _call(_a) {
        return __awaiter(this, arguments, void 0, function* ({ name, symbol, totalSupply }) {
            const wallet = this.tools.getWallet();
            if (!wallet)
                return "No wallet set. Please set a wallet first.";
            const factory = new ethers_1.ethers.ContractFactory(TOKEN_ABI, TOKEN_BYTECODE, wallet);
            try {
                // Convert totalSupply to wei (18 decimals for ERC-20 standard)
                const totalSupplyWei = ethers_1.ethers.parseUnits(totalSupply, 18);
                const contract = yield factory.deploy(name, symbol, totalSupplyWei);
                yield contract.waitForDeployment();
                const contractAddress = yield contract.getAddress();
                log.info(`Token ${name} (${symbol}) created at: ${contractAddress}`);
                return `Token ${name} (${symbol}) created successfully at ${MONAD_EXPLORER_URL}/address/${contractAddress}`;
            }
            catch (error) {
                log.error("CreateTokenTool error:", error);
                throw new Error(`Failed to create token: ${error instanceof Error ? error.message : String(error)}`);
            }
        });
    }
}
// New Tool: Request Tokens from Monad Faucet
class GetFaucetTokensTool extends tools_1.StructuredTool {
    constructor() {
        super(...arguments);
        this.schema = zod_1.z.object({
            address: zod_1.z.string().describe("The wallet address to receive testnet MON tokens"),
        });
        this.name = "getFaucetTokens";
        this.description = "Request testnet MON tokens from the Monad faucet";
    }
    _call(_a) {
        return __awaiter(this, arguments, void 0, function* ({ address }) {
            try {
                // Since the faucet requires browser interaction (wallet connection), we provide instructions
                // An actual API call isn’t available, so we simulate the guidance
                if (!ethers_1.ethers.isAddress(address)) {
                    return "Invalid Ethereum address provided.";
                }
                return `To get testnet MON tokens for ${address}, visit ${MONAD_FAUCET_URL}, connect your wallet, paste your address (${address}), and click 'Get Testnet MON'. Tokens are available every 12 hours based on eligibility (e.g., Discord role or ETH activity).`;
            }
            catch (error) {
                log.error("GetFaucetTokensTool error:", error);
                return `Failed to process faucet request: ${error instanceof Error ? error.message : String(error)}`;
            }
        });
    }
}
class HelpTool extends tools_1.StructuredTool {
    constructor() {
        super(...arguments);
        this.schema = zod_1.z.object({});
        this.name = "help";
        this.description = "List all available commands";
    }
    _call() {
        return __awaiter(this, void 0, void 0, function* () {
            const commands = [
                "setWallet <privateKey> - Set your wallet",
                "getWalletAddress - Get your wallet address",
                "getBalance - Check your MONAD balance",
                "transferTokens <to> <amount> - Transfer MONAD tokens",
                "signMessage <message> - Sign a message",
                "getTransactionHistory [count] - Get recent transactions (default 5)",
                "getGasPrice - Get current gas price",
                "getTokenPrice <token> - Get token price (e.g., MONAD)",
                "getTrendingTokens - Get trending tokens from Monad explorer",
                "createToken <name> <symbol> <totalSupply> - Create a new token on Monad Testnet",
                "getFaucetTokens <address> - Request testnet MON tokens from Monad faucet",
                "help - Show this list",
            ];
            return `Available commands:\n${commands.join("\n")}`;
        });
    }
}
// Instantiate tools
const blockchainTools = new BlockchainTools();
const tools = [
    new SetWalletTool(blockchainTools),
    new GetWalletAddressTool(blockchainTools),
    new GetBalanceTool(blockchainTools),
    new TransferTokensTool(blockchainTools),
    new SignMessageTool(blockchainTools),
    new GetTransactionHistoryTool(blockchainTools),
    new GetGasPriceTool(blockchainTools),
    new GetTokenPriceTool(),
    new GetTrendingTokensTool(),
    new CreateTokenTool(blockchainTools),
    new GetFaucetTokensTool(),
    new HelpTool(),
];
const toolNode = new prebuilt_1.ToolNode(tools);
const modelWithTools = llm.bindTools(tools);
// Agent logic
function callAgent(state) {
    return __awaiter(this, void 0, void 0, function* () {
        const response = yield modelWithTools.invoke(state.messages);
        return { messages: [response] };
    });
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
            reducer: (x, y) => (x !== null && x !== void 0 ? x : []).concat(y !== null && y !== void 0 ? y : []),
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
// Express server
const app = (0, express_1.default)();
app.use(body_parser_1.default.json());
const agentHandler = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { input, privateKey } = req.body;
    if (!input) {
        res.status(400).json({ error: "Input is required" });
        return;
    }
    try {
        const messages = [];
        if (privateKey) {
            messages.push(new messages_1.HumanMessage(`Set wallet with private key: ${privateKey}`));
        }
        messages.push(new messages_1.HumanMessage(input));
        const result = yield agent.invoke({ messages });
        const lastMessage = result.messages[result.messages.length - 1];
        res.json({ response: lastMessage.content });
    }
    catch (error) {
        log.error("Agent handler error:", error);
        res.status(500).json({ error: `Internal server error: ${error instanceof Error ? error.message : String(error)}` });
    }
});
app.post("/agent", agentHandler);
const PORT = 3000;
app.listen(PORT, () => {
    log.info(`Server running on http://localhost:${PORT}`);
});
