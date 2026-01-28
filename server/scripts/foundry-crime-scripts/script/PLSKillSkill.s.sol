// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Script} from "forge-std/Script.sol";

interface IKillSkill {
    // trainType: 0 = Free (bottles), 1 = $5000 (shooting range), 2 = $30000 (personal trainer)
    function trainSkill(uint8 trainType) external;
}

contract PLSKillSkill is Script {
    // PLS Mainnet Kill Skill contract address
    address constant PLS_KILL_SKILL_CA = 0xdC45E5469A8B6D020473F69fEC91C0f0e83a3308;

    function run(uint8 trainType) external {
        trainSkill(trainType);
    }

    // Default to free training (type 0)
    function run() external {
        trainSkill(0);
    }

    function trainSkill(uint8 trainType) public {
        vm.startBroadcast();
        IKillSkill killSkillContract = IKillSkill(PLS_KILL_SKILL_CA);
        killSkillContract.trainSkill(trainType);
        vm.stopBroadcast();
    }
}
