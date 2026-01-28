// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Script} from "forge-std/Script.sol";

interface ITravel {
    function travel(uint8 destinationCity, uint8 travelType, uint256 itemId) external;
}

contract BNBTravel is Script {
    // BNB Mainnet Travel contract address
    address constant BNB_CRIME_CA = 0xa08D627E071cB4b53C6D0611d77dbCB659902AA4;

    function run(uint8 destinationCity, uint8 travelType, uint256 itemId) external {
        crime(destinationCity, travelType, itemId);
    }

    function crime(uint8 destinationCity, uint8 travelType, uint256 itemId) public {
        // Start broadcast
        vm.startBroadcast();

        // Create an instance of the contract
        ITravel travelContract = ITravel(BNB_CRIME_CA);

        // Call the trainSkill function
        travelContract.travel(destinationCity, travelType, itemId);

        // Stop broadcast
        vm.stopBroadcast();
    }
}
