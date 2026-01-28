// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Script} from "forge-std/Script.sol";

interface ITravel {
    function travel(uint8 destinationCity, uint8 travelType, uint256 itemId) external;
}

contract PLSTravel is Script {
    // PLS Mainnet Travel contract address
    address constant PLS_CRIME_CA = 0x7FB6A056877c1da14a63bFECdE95ebbFa854f07F;

    function run(uint8 destinationCity, uint8 travelType, uint256 itemId) external {
        crime(destinationCity, travelType, itemId);
    }

    function crime(uint8 destinationCity, uint8 travelType, uint256 itemId) public {
        // Start broadcast
        vm.startBroadcast();

        // Create an instance of the contract
        ITravel travelContract = ITravel(PLS_CRIME_CA);

        // Call the trainSkill function
        travelContract.travel(destinationCity, travelType, itemId);

        // Stop broadcast
        vm.stopBroadcast();
    }
}
