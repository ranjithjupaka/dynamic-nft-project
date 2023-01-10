// SPDX-License-Identifier: MIT
pragma solidity ^0.8.8;

import "@openzeppelin/contracts/token/ERC721/extensions/ERC721URIStorage.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@chainlink/contracts/src/v0.8/VRFConsumerBaseV2.sol";
import "@chainlink/contracts/src/v0.8/interfaces/VRFCoordinatorV2Interface.sol";

error RandomIpfsNft__AlreadyInitialized();
error RandomIpfsNft__NeedMoreETHSent();
error RandomIpfsNft__RangeOutOfBounds();
error RandomIpfsNft__TransferFailed();

contract DynamicNft is ERC721URIStorage, VRFConsumerBaseV2, Ownable {
    enum Eye {
        VIOLET,
        YELLOW_SMALL,
        YELLOW_MEDIUM,
        YELLOW_LARGE
    }

    // Chainlink VRF Variables
    VRFCoordinatorV2Interface private immutable i_vrfCoordinator;
    uint64 private immutable i_subscriptionId;
    bytes32 private immutable i_gasLane;
    uint32 private immutable i_callbackGasLimit;
    uint16 private constant REQUEST_CONFIRMATIONS = 3;
    uint32 private constant NUM_WORDS = 1;

    // VRF Helpers
    mapping(uint256 => address) public s_requestIdToSender;

    // NFT Variables
    uint256 private immutable i_mintFee;
    uint256 private s_tokenCounter;
    string[] internal s_tokenUris;
    bool private s_initialized;
    uint256 internal constant MAX_CHANCE_VALUE = 100;

    // Events
    event NftRequested(uint256 indexed requestId, address requester);
    event NftMinted(Eye eye, address minter);

    constructor(
        address vrfCoordinatorV2,
        uint64 subscriptionId,
        bytes32 gasLane, // keyHash
        uint32 callbackGasLimit,
        uint256 mintFee,
        string[3] memory tokenUris
    ) VRFConsumerBaseV2(vrfCoordinatorV2) ERC721("DynamicNft", "DYNFT") {
        i_vrfCoordinator = VRFCoordinatorV2Interface(vrfCoordinatorV2);
        i_gasLane = gasLane;
        i_subscriptionId = subscriptionId;
        i_callbackGasLimit = callbackGasLimit;
        _initializeContract(tokenUris);
        i_mintFee = mintFee;
        s_tokenCounter = 0;
    }

    function _initializeContract(string[3] memory tokenUris) private {
        if (s_initialized) {
            revert RandomIpfsNft__AlreadyInitialized();
        }
        s_tokenUris = tokenUris;
        s_initialized = true;
    }

    function requestNft() public payable returns (uint256 requestId) {
        if (msg.value < i_mintFee) {
            revert RandomIpfsNft__NeedMoreETHSent();
        }
        requestId = i_vrfCoordinator.requestRandomWords(
            i_gasLane,
            i_subscriptionId,
            REQUEST_CONFIRMATIONS,
            i_callbackGasLimit,
            NUM_WORDS
        );
        s_requestIdToSender[requestId] = msg.sender;
        emit NftRequested(requestId, msg.sender);
    }

    function fulfillRandomWords(
        uint256 requestId,
        uint256[] memory randomWords
    ) internal override {
        address nftOwner = s_requestIdToSender[requestId];
        uint256 newItemId = s_tokenCounter;
        s_tokenCounter = s_tokenCounter + 1;
        uint256 moddedRng = randomWords[0] % MAX_CHANCE_VALUE;
        Eye eye = getEyeFromModdedRng(moddedRng);
        _safeMint(nftOwner, newItemId);
        _setTokenURI(newItemId, s_tokenUris[uint256(eye)]);
        emit NftMinted(eye, nftOwner);
    }

    function getEyeFromModdedRng(uint256 moddedRng) public pure returns (Eye) {
        uint256 cumulativeSum = 0;
        uint256[4] memory chanceArray = getChanceArray();
        for (uint256 i = 0; i < chanceArray.length; i++) {
            // Violet = 0 - 9  (10%)
            // Yellow small = 10 - 29  (20%)
            // Yellow medium= 30 - 59 (30%)
            //  Yellow large = 60 - 99 (40%)
            if (moddedRng >= cumulativeSum && moddedRng < chanceArray[i]) {
                return Eye(i);
            }
            cumulativeSum = chanceArray[i];
        }
        revert RandomIpfsNft__RangeOutOfBounds();
    }

    function withdraw() public onlyOwner {
        uint256 amount = address(this).balance;
        (bool success, ) = payable(msg.sender).call{value: amount}("");
        if (!success) {
            revert RandomIpfsNft__TransferFailed();
        }
    }

    function getChanceArray() public pure returns (uint256[4] memory) {
        return [10, 30, 60, MAX_CHANCE_VALUE];
    }

    function getTokenUris(uint256 index) public view returns (string memory) {
        return s_tokenUris[index];
    }

    function getInitialized() public view returns (bool) {
        return s_initialized;
    }

    function getMintFee() public view returns (uint256) {
        return i_mintFee;
    }

    function getTokenCounter() public view returns (uint256) {
        return s_tokenCounter;
    }
}
