// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Script} from "forge-std/Script.sol";

interface IKillSkill {
    function trainSkill(uint8 trainType) external;
}

contract BNBKillSkill is Script {
    // BNB Mainnet Kill Skill contract address
    address constant BNB_KILL_SKILL_CA = 0xa5dc2Cb4dC13f12d8464eaA862fAC00F19ADc84d;

    function run(uint8 trainType) external {
        trainSkill(trainType);
    }

    function run() external {
        trainSkill(0);
    }

    function trainSkill(uint8 trainType) public {
        vm.startBroadcast();
        IKillSkill killSkillContract = IKillSkill(BNB_KILL_SKILL_CA);
        killSkillContract.trainSkill(trainType);
        vm.stopBroadcast();
    }
}
