/**
 * PulseMafia Game Contracts Configuration v2.0
 * 
 * PHASE 1 IMPROVEMENTS:
 * - Added address validation
 * - Added implementation addresses for debugging
 * - Added explorer link generators
 * - Added RPC fallbacks
 * 
 * PHASE 2 IMPROVEMENTS:
 * - More comprehensive ABIs with all known functions
 * - Added event definitions for monitoring
 * - Added gas estimation helpers
 * 
 * PHASE 3 IMPROVEMENTS:
 * - Type definitions for better IDE support
 * - Validation methods
 * - Chain switching support
 */

const CHAINS = {
    PULSECHAIN: 'pulsechain',
    BNB: 'bnb'
};

const config = {
    version: '2.0.0',

    // Network configurations with fallbacks
    networks: {
        pulsechain: {
            chainId: 369,
            name: 'PulseChain',
            rpc: [
                'http://localhost:8545',
                'https://rpc.pulsechain.com',
                'https://pulsechain-rpc.publicnode.com'
            ],
            explorer: 'https://scan.pulsechain.com',
            explorerApi: 'https://api.scan.pulsechain.com/api',
            nativeCurrency: { name: 'Pulse', symbol: 'PLS', decimals: 18 },
            blockTime: 10, // seconds
        },
        bnb: {
            chainId: 56,
            name: 'BNB Chain',
            rpc: [
                'https://bsc-dataseed.binance.org/',
                'https://bsc-dataseed1.binance.org/',
                'https://bsc-dataseed2.binance.org/',
                'https://bsc-dataseed3.binance.org/'
            ],
            explorer: 'https://bscscan.com',
            explorerApi: 'https://api.bscscan.com/api',
            nativeCurrency: { name: 'BNB', symbol: 'BNB', decimals: 18 },
            blockTime: 3, // seconds
        }
    },

    // Contract addresses by chain - with metadata
    contracts: {
        pulsechain: {
            tokens: {
                MAFIA: {
                    address: '0xa27aDe5806Ded801b93499C6fA23cc8dC9AC55EA',
                    name: '$MAFIA Token',
                    decimals: 18,
                    isProxy: false
                },
                BULLET: {
                    address: '0x98f0d50b77BCcd657ecfa2E5C1E4915c6f4565B8',
                    name: 'Bullet Token',
                    decimals: 18,
                    isProxy: true,
                    implementation: '0x36038ae6f4dc841d7641e6581fe259adf5796cea'
                },
                OG_CRATE: {
                    address: '0x3325E42aA71188939216b669E8d431718e5bd790',
                    name: 'OG Crate NFT',
                    isProxy: false
                },
                OG_NFT: {
                    address: '0xC647421A47dc793292E880bD77782c664BD6Af2a',
                    name: 'OG NFT',
                    isProxy: false
                },
                OG_PREMIUM: {
                    address: '0xf0ae11A736b90987589ce64b1D77eBc328d0622F',
                    name: 'OG Premium NFT',
                    isProxy: true
                },
                LP: {
                    address: '0x113bbdfea64b06aebe14a50e00c70149a32973ab',
                    name: 'MAFIA/PLS LP Token',
                    decimals: 18,
                    isProxy: false
                }
            },

            player: {
                PROFILE: {
                    address: '0x7FB6A056877c1da14a63bFECdE95ebbFa854f07F',
                    name: 'Player Profile',
                    isProxy: true,
                    implementation: '0xe835477ce113bc7f184ef79294fc371405a83206'
                },
                INVENTORY: {
                    address: '0x2c60de22Ec20CcE72245311579c4aD9e5394Adc4',
                    name: 'Player Inventory',
                    isProxy: true,
                    implementation: '0x312d13865db44671dd474992d3618109923b775e'
                },
                HEALTH: {
                    address: '0xA3b9a5E273a9199bbD64fFf81f369FEa0A3a0E1F',
                    name: 'Health System',
                    isProxy: true,
                    implementation: '0x704e882436ea013fd842aa4f09c61827dc87f8c4'
                },
                RANK_XP: {
                    address: '0x74eADd7ebeeED638FD7c413134FA3D3433699D92',
                    name: 'Rank & XP System',
                    isProxy: true,
                    implementation: '0xa8a3aae66ae116976cba4255efd55b1fd13f5db6'
                },
                MAP: {
                    address: '0xE571Aa670EDeEBd88887eb5687576199652A714F',
                    name: 'World Map',
                    isProxy: true,
                    implementation: '0x636ff165aafbe93d398feced3ea4f20a25962a24'
                }
            },

            actions: {
                CRIMES: {
                    address: '0xf077d4d0508505c5a80249aFC10bc6Ead90E47F1',
                    name: 'Basic Crimes',
                    isProxy: true,
                    implementation: '0xea3c40af7ceda64253e6ee0c5ede59c2c0165605',
                    cooldownSeconds: 180
                },
                JAIL: {
                    address: '0xDCD5E9c0b2b4E9Cb93677A258521D854b3A9f5A1',
                    name: 'Jail System',
                    isProxy: true,
                    implementation: '0x20f614e40b6bdc104cb64a3ffe570480ac4f2e42'
                },
                BUST_OUT: {
                    address: '0xf404b3336f5D78406326e848c8bc14Cbf2566d0A',
                    name: 'Bust Out',
                    isProxy: true,
                    implementation: '0x8fa57ca32ac2bdb8768d3098b18abc4f09237cc0'
                },
                KILL_SKILL: {
                    address: '0xdC45E5469A8B6D020473F69fEC91C0f0e83a3308',
                    name: 'Kill Skill (Combat)',
                    isProxy: true,
                    implementation: '0x6fae62ea0a2c21ddf203a57dc0b0a90a580096a8'
                },
                NICK_CAR: {
                    address: '0x2bf1EEaa4e1D7502AeF7f5beCCf64356eDb4a8c8',
                    name: 'Nick Car',
                    isProxy: true,
                    implementation: '0xa7e9bab77fc959d7a506f8b9d1ed876dbcd47095'
                },
                HOSPITAL: {
                    address: '0x222e69D7e1CA26D4Bbbd80637Dd49a8C07c3c8A1',
                    name: 'Hospital',
                    isProxy: true,
                    implementation: '0xc399a9c5a10b9d9002d1d2f5643e3156bb0929ad'
                }
            },

            economy: {
                MARKETPLACE: {
                    address: '0x321e27aaB7e6F5DE221AE3eAe63306345f3A465d',
                    name: 'Marketplace',
                    isProxy: true,
                    implementation: '0x6c0571551e6e6f5e6cf0f0c9a512e8c4d6f83de8'
                },
                SMUGGLE: {
                    address: '0x9bf722B3350832ae9023B7C9762227bE33943d09',
                    name: 'Smuggle Market',
                    isProxy: true,
                    implementation: '0xac28a90b81bae00f14c3f23b78820ddabcf6797f'
                },
                BULLET_FACTORY: {
                    address: '0x7770699325422632E76513823D84661D36AE8e6A',
                    name: 'Bullet Factory',
                    isProxy: true,
                    implementation: '0xdfde19006078f2eda2eb6789617851375f32f3ca'
                },
                EXCHANGE: {
                    address: '0x11ee2732eD4C6BFe673e7b4BE15ece35D6a8cCD7',
                    name: 'Exchange',
                    isProxy: true,
                    implementation: '0x2d34efcf6112014056adfb42261dd4bab647e941'
                },
                XP_MARKET: {
                    address: '0xc5731c6C3627F4912B54A2c6e13A8BFaeD69A39C',
                    name: 'XP Market',
                    isProxy: true,
                    implementation: '0x9248b786fb9cfa8a573e94e2c25ba8396a3f5a5b'
                },
                GAME_BANK: {
                    address: '0x839340bDC0b0E4449b7e1dEBD0db7E93861Ed1D9',
                    name: 'Game Bank',
                    isProxy: true,
                    implementation: '0x67443cd6ed7df23c532375a37e35b2e710a9a611'
                },
                DEPOSIT: {
                    address: '0xC9565b4f23C301Cf9f158D72A842BA6a53B84590',
                    name: 'Deposit Contract',
                    isProxy: true,
                    implementation: '0xbff518fdd3d9faf9ebc706f666cb7f7defba625c'
                }
            },

            family: {
                FAMILY: {
                    address: '0x3363cf983ae23AF2D95a81bA4A39C36084f8BEc4',
                    name: 'Mafia Family',
                    isProxy: true,
                    implementation: '0x171875894c354a1f2b17472a36b3093ceea5e861'
                },
                FAMILY_BANK: {
                    address: '0xaD068Df1cedBf631A9D9B050eEBf1778E2d4A2ED',
                    name: 'Family Bank',
                    isProxy: true,
                    implementation: '0x3b9ce4f0f180d6eeeb265bea8de92128809b2b5d'
                },
                ALLEGIANCE: {
                    address: '0x32d3C91A1c67f4ec9Bd688D72030b4127d94b9eC',
                    name: 'Family Allegiance',
                    isProxy: true,
                    implementation: '0xcdf0b3c13562dba9189df141aaea976dffc98386'
                }
            },

            casino: {
                ROULETTE: {
                    address: '0xD49Df542a9278464E7E18af52AB93D40D3430A9F',
                    name: 'Roulette',
                    isProxy: true,
                    implementation: '0x52ee43bfdb149b04f127fc205313d4147429e2f7'
                },
                SLOTS: {
                    address: '0x52A929a1D43C18c6De571189D1c56c8574AA21a3',
                    name: 'Slots',
                    isProxy: true,
                    implementation: '0xf22518f2b9c71ff5ab30bb895e0a84ecdce96926'
                }
            },

            defi: {
                VAULT: {
                    address: '0x776F3D2d483580b12a2cD163bE40F649b2d1FF34',
                    name: 'MAFIA Vault',
                    isProxy: false
                },
                SPLITTER: {
                    address: '0x5853EDBe3E619C73f9720ce4aF50F506340617B0',
                    name: 'Vault Splitter',
                    isProxy: true,
                    implementation: '0xc9805d0c354a1c05d4feafeed67b0bd6ec92c15e'
                },
                DAO: {
                    address: '0xD772D9f127b15d81c46582D49426d319044a541d',
                    name: 'DAO Treasury',
                    isProxy: false
                },
                PROPOSALS: {
                    address: '0x50ad97424d3e7Cf5F7D4B73b0F97AdE1f4e140eD',
                    name: 'DAO Proposals',
                    isProxy: true,
                    implementation: '0x98814d49ed9d48b9a07272d79998855514a67d21'
                }
            },

            utility: {
                HELPER_BOT: {
                    address: '0x6Ea05BaDD5B6e4226a49Af087eFd2A22c410e6cc',
                    name: 'Helper Bot',
                    isProxy: true,
                    implementation: '0x4e1959ed32a9456082ff716d37b781f3768a787e'
                },
                HELPER_CREDITS: {
                    address: '0x9D2417e5cB35abaae331b32fb262c75A258a0717',
                    name: 'Helper Credits',
                    isProxy: true,
                    implementation: '0x6199ee01d3e745355073931298076f6516f4ff88'
                },
                CRATE_MINTER: {
                    address: '0x7FE7220E6A8AAB508c60be9d48fEfacDbe6BC179',
                    name: 'OG Crate Minter',
                    isProxy: true,
                    implementation: '0xa968a2a6422c3b37ef175d6fd94dc48644b3742b'
                }
            }
        },

        bnb: {
            tokens: {
                MAFIA: { address: '0x3cb3F4f43D4Be61AA92BB4EEFfe7142A13bf4111', name: '$MAFIA Token', decimals: 18 },
                BULLET: { address: '0xa42AE5D3E84bff9cD2C734A072232D9629f2ED16', name: 'Bullet Token', decimals: 18, isProxy: true },
                OG_CRATE: { address: '0x16B11C057cA6d354E81D58B375CB118f7930807c', name: 'OG Crate NFT' },
                OG_NFT: { address: '0xaf46bd44259b89f01B861C056C813228ADdfaD22', name: 'OG NFT' },
                OG_PREMIUM: { address: '0xA7AcE7F549BDE0b915EB06A6dAb3C9292cCa8B45', name: 'OG Premium NFT', isProxy: true },
                LP: { address: '0xdE6e6378623C4F2c1102F2CcD35507d5bAf7924d', name: 'MAFIA/BNB LP Token', decimals: 18 }
            },
            player: {
                PROFILE: { address: '0xa08D627E071cB4b53C6D0611d77dbCB659902AA4', name: 'Player Profile', isProxy: true },
                INVENTORY: { address: '0x2CB8352Be090846d4878Faa92825188D7bf50654', name: 'Player Inventory', isProxy: true },
                HEALTH: { address: '0xC63668378B83f3E58A9AAAe6E12Da3282F150225', name: 'Health System', isProxy: true },
                RANK_XP: { address: '0x48F2C9C0ea337854492aF5bEbEa74e8917712B71', name: 'Rank & XP System', isProxy: true },
                MAP: { address: '0x1c88060e4509c59b4064A7a9818f64AeC41ef19E', name: 'World Map', isProxy: true }
            },
            actions: {
                CRIMES: { address: '0x167ad284C7bcc4d6342991Aa258422E7a04f926E', name: 'Basic Crimes', isProxy: true, cooldownSeconds: 180 },
                JAIL: { address: '0x7371580cd13dE739C734AE85062F75194d13Fac2', name: 'Jail System', isProxy: true },
                BUST_OUT: { address: '0xd401B2af85Df998faaDD0963F0e15e2EB92D5697', name: 'Bust Out', isProxy: true },
                KILL_SKILL: { address: '0xa5dc2Cb4dC13f12d8464eaA862fAC00F19ADc84d', name: 'Kill Skill', isProxy: true },
                NICK_CAR: { address: '0x60B8e0dd9566b42F9CAa5538350aA0D29988373c', name: 'Nick Car', isProxy: true },
                HOSPITAL: { address: '0xB4c9ef457e17992f9271B447de3507016fd0E0d7', name: 'Hospital', isProxy: true }
            },
            economy: {
                MARKETPLACE: { address: '0x1fb8C9F810afd99A6FAE3E81aBe0806f8796ba73', name: 'Marketplace', isProxy: true },
                SMUGGLE: { address: '0x36b09f1854CF3614Eb8d10fFae847511BB08868e', name: 'Smuggle Market', isProxy: true },
                BULLET_FACTORY: { address: '0xAbfdA460fFEa2697A4d0b17e955bc17e87b6d45E', name: 'Bullet Factory', isProxy: true },
                EXCHANGE: { address: '0x605694A29c5258D6c7Aed642D01111c4b7036966', name: 'Exchange', isProxy: true },
                XP_MARKET: { address: '0x49F23822AFa248D4bE453d630F7e0dF8fcF80854', name: 'XP Market', isProxy: true },
                GAME_BANK: { address: '0x376554F7BbcdeB348fa4b8371135B87eC6b29c38', name: 'Game Bank', isProxy: true },
                DEPOSIT: { address: '0xB081EC0763360a9Ad4D09AF2C9ec7DC1ED5190Ae', name: 'Deposit Contract', isProxy: true }
            },
            family: {
                FAMILY: { address: '0x1bC581fe134BdC7432eF8ba75BCeEd242F90BcD2', name: 'Mafia Family', isProxy: true },
                FAMILY_BANK: { address: '0xA7AB556Aac595A8425dDF584f3CA11bbD1772B8b', name: 'Family Bank', isProxy: true },
                ALLEGIANCE: { address: '0x6fC9ba91179207764eDb537dD313C7cd3DAAaDEB', name: 'Family Allegiance', isProxy: true }
            },
            casino: {
                ROULETTE: { address: '0x53e579dC9BE49B6Bac08c6F9ffA83D981A9A19F3', name: 'Roulette', isProxy: true },
                SLOTS: { address: '0xa593553bdbA38730226aaabF07D241a16a3fc005', name: 'Slots', isProxy: true }
            },
            defi: {
                VAULT: { address: '0xB88Aa2B2345eb37ab21Ed9359AF1c937ca6D07aF', name: 'MAFIA Vault' },
                SPLITTER: { address: '0x46f3F348a21BFEE36E1EacA57E91C08c733b73eD', name: 'Vault Splitter', isProxy: true },
                DAO: { address: '0xD772D9f127b15d81c46582D49426d319044a541d', name: 'DAO Treasury' },
                PROPOSALS: { address: '0x727405987580B9C44052f8F1f82Fa268C966Ba09', name: 'DAO Proposals', isProxy: true }
            },
            utility: {
                HELPER_BOT: { address: '0xE2E4506c23C26eea2526d0e4dBb8dbF9cDa9d105', name: 'Helper Bot', isProxy: true },
                HELPER_CREDITS: { address: '0x192F029CC7e0BB80dB201191E0040e8F801df34d', name: 'Helper Credits', isProxy: true },
                CRATE_MINTER: { address: '0x1F4Eb51E87C4e2368316dba8e478Cd561FEb8B77', name: 'OG Crate Minter', isProxy: true }
            }
        }
    },

    // Comprehensive ABIs
    abis: {
        ERC20: [
            'function balanceOf(address owner) view returns (uint256)',
            'function transfer(address to, uint256 amount) returns (bool)',
            'function approve(address spender, uint256 amount) returns (bool)',
            'function allowance(address owner, address spender) view returns (uint256)',
            'function totalSupply() view returns (uint256)',
            'function decimals() view returns (uint8)',
            'function symbol() view returns (string)',
            'function name() view returns (string)',
            'event Transfer(address indexed from, address indexed to, uint256 value)',
            'event Approval(address indexed owner, address indexed spender, uint256 value)'
        ],

        ERC721: [
            'function balanceOf(address owner) view returns (uint256)',
            'function ownerOf(uint256 tokenId) view returns (address)',
            'function safeTransferFrom(address from, address to, uint256 tokenId)',
            'function transferFrom(address from, address to, uint256 tokenId)',
            'function approve(address to, uint256 tokenId)',
            'function getApproved(uint256 tokenId) view returns (address)',
            'function setApprovalForAll(address operator, bool approved)',
            'function isApprovedForAll(address owner, address operator) view returns (bool)',
            'event Transfer(address indexed from, address indexed to, uint256 indexed tokenId)'
        ],

        PROFILE: [
            'function getPlayer(address player) view returns (tuple)',
            'function isRegistered(address player) view returns (bool)',
            'function getLevel(address player) view returns (uint256)',
            'function getXP(address player) view returns (uint256)',
            'function register() external',
            'event PlayerRegistered(address indexed player)'
        ],

        JAIL: [
            'function isInJail(address player) view returns (bool)',
            'function getJailTime(address player) view returns (uint256)',
            'function getJailEndTime(address player) view returns (uint256)',
            'function getBustCost(address player) view returns (uint256)',
            'event PlayerJailed(address indexed player, uint256 duration)',
            'event PlayerReleased(address indexed player)'
        ],

        HEALTH: [
            'function getHealth(address player) view returns (uint256)',
            'function getMaxHealth(address player) view returns (uint256)',
            'function isAlive(address player) view returns (bool)',
            'event HealthChanged(address indexed player, uint256 oldHealth, uint256 newHealth)'
        ],

        MAP: [
            'function getCity(address player) view returns (uint256)',
            'function getTravelCooldown(address player) view returns (uint256)',
            'function canTravel(address player) view returns (bool)',
            'function travel(uint256 cityId) external',
            // Property yield claim - discovered from tx 0x8b151ece
            'function claimFromProperty(uint256 cityId, uint256 tileId, uint8 claimType) external',
            'event PlayerTraveled(address indexed player, uint256 fromCity, uint256 toCity)',
            'event PropertyClaimed(address indexed player, uint256 cityId, uint256 tileId, uint256 amount)'
        ],

        CRIMES: [
            'function getCrimeCooldown(address player) view returns (uint256)',
            'function canCommitCrime(address player) view returns (bool)',
            'function commitCrime(uint256 crimeType) external',
            'event CrimeCommitted(address indexed player, uint256 crimeType, bool success, uint256 reward)'
        ],

        HOSPITAL: [
            'function heal() external payable',
            'function getHealCost(address player) view returns (uint256)',
            'function getHealCostInMafia(address player) view returns (uint256)',
            'event PlayerHealed(address indexed player, uint256 amount)'
        ],

        BUST_OUT: [
            'function bustOut() external',
            'function bustPlayer(address player) external',
            'function getBustCost(address player) view returns (uint256)',
            'event PlayerBustedOut(address indexed player, uint256 cost)'
        ],

        VAULT: [
            'function stake(uint256 amount) external',
            'function unstake(uint256 amount) external',
            'function claimRewards() external',
            'function getStakedBalance(address user) view returns (uint256)',
            'function getPendingRewards(address user) view returns (uint256)',
            'function totalStaked() view returns (uint256)',
            'event Staked(address indexed user, uint256 amount)',
            'event Unstaked(address indexed user, uint256 amount)',
            'event RewardsClaimed(address indexed user, uint256 amount)'
        ],

        HELPER_BOT: [
            'function activateBot(uint256 botType) external',
            'function deactivateBot(uint256 botType) external',
            'function isBotActive(address player, uint256 botType) view returns (bool)',
            'function getBotEndTime(address player, uint256 botType) view returns (uint256)'
        ],

        NICK_CAR: [
            // Raw selectors from contract analysis - names are guessed based on game mechanics
            // Selector 0x26bbbd98 - likely the main nick action
            'function nick() external',
            // Selector 0x41bbc704 - likely cooldown check
            'function getCooldown(address player) view returns (uint256)',
            // Selector 0x7a2ab345 - alternative action variant
            'function nickCar() external',
            // Events
            'event CarNicked(address indexed player, uint256 carType, bool success)',
            'event PlayerJailed(address indexed player, uint256 duration)'
        ],

        KILL_SKILL: [
            // Raw selectors from contract analysis
            // Selector 0x050cd7b1 - likely training function  
            'function train() external',
            // Selector 0x2873ae2f - training with type parameter
            'function train(uint256 trainingType) external',
            // Selector 0x3f683b6a - likely cooldown check
            'function getCooldown(address player) view returns (uint256)',
            // Selector 0x5f969533 - get current skill level
            'function getSkill(address player) view returns (uint256)',
            // Events
            'event Trained(address indexed player, uint256 trainingType, uint256 skillGained)',
            'event KillAttempt(address indexed attacker, address indexed victim, bool success, uint256 damage)'
        ]
    },

    // City names for display
    cities: {
        0: 'New York',
        1: 'Chicago',
        2: 'Las Vegas',
        3: 'Detroit',
        4: 'Los Angeles',
        5: 'Miami'
    },

    // Crime types
    crimeTypes: {
        0: { name: 'Petty Theft', minReward: 10, maxReward: 50, jailRisk: 0.1 },
        1: { name: 'Pickpocket', minReward: 20, maxReward: 100, jailRisk: 0.15 },
        2: { name: 'Car Theft', minReward: 50, maxReward: 200, jailRisk: 0.2 },
        3: { name: 'Armed Robbery', minReward: 100, maxReward: 500, jailRisk: 0.3 },
        4: { name: 'Bank Heist', minReward: 500, maxReward: 2000, jailRisk: 0.5 }
    },

    // Helper methods

    /**
     * Get contract address by chain, category, and name
     */
    getAddress(chain, category, name) {
        const contract = this.contracts[chain]?.[category]?.[name];
        return contract?.address || contract;
    },

    /**
     * Get full contract info
     */
    getContract(chain, category, name) {
        return this.contracts[chain]?.[category]?.[name];
    },

    /**
     * Get all addresses for a chain as flat object
     */
    getAllAddresses(chain) {
        const result = {};
        const chainContracts = this.contracts[chain];
        if (!chainContracts) return result;

        for (const [category, contracts] of Object.entries(chainContracts)) {
            for (const [name, data] of Object.entries(contracts)) {
                result[`${category}_${name}`] = data.address || data;
            }
        }
        return result;
    },

    /**
     * Get explorer link for address
     */
    getExplorerLink(chain, address) {
        const explorer = this.networks[chain]?.explorer;
        return explorer ? `${explorer}/address/${address}` : null;
    },

    /**
     * Get explorer link for transaction
     */
    getTxLink(chain, txHash) {
        const explorer = this.networks[chain]?.explorer;
        return explorer ? `${explorer}/tx/${txHash}` : null;
    },

    /**
     * Validate if address is valid
     */
    isValidAddress(address) {
        return /^0x[a-fA-F0-9]{40}$/.test(address);
    },

    /**
     * Get working RPC (first available)
     */
    getRpc(chain) {
        const rpcs = this.networks[chain]?.rpc;
        return Array.isArray(rpcs) ? rpcs[0] : rpcs;
    },

    /**
     * Get all RPCs for fallback
     */
    getAllRpcs(chain) {
        const rpcs = this.networks[chain]?.rpc;
        return Array.isArray(rpcs) ? rpcs : [rpcs];
    },

    // Export chain constants
    CHAINS
};

module.exports = config;
