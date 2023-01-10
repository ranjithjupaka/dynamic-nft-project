const { network, ethers } = require('hardhat')

module.exports = async ({ getNamedAccounts }) => {
  const { deployer } = await getNamedAccounts()
  const chainId = network.config.chainId

  const dynamicNft = await ethers.getContract('DynamicNft', deployer)
  const mintFee = await dynamicNft.getMintFee()
  const dynamicNftMintTx = await dynamicNft.requestNft({
    value: mintFee.toString(),
  })
  const dynamicNftMintTxReceipt = await dynamicNftMintTx.wait(1)
  // Need to listen for response
  await new Promise(async (resolve, reject) => {
    setTimeout(() => reject("Timeout: 'NFTMinted' event did not fire"), 300000) // 5 minute timeout time
    // setup listener for our event
    dynamicNft.once('NftMinted', async () => {
      resolve()
    })
    if (chainId == 31337) {
      const requestId =
        dynamicNftMintTxReceipt.events[1].args.requestId.toString()
      const vrfCoordinatorV2Mock = await ethers.getContract(
        'VRFCoordinatorV2Mock',
        deployer
      )
      await vrfCoordinatorV2Mock.fulfillRandomWords(
        requestId,
        dynamicNft.address
      )
    }
  })
}

module.exports.tags = ['all', 'mint']
