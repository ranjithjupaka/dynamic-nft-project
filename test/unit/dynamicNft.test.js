const { assert, expect } = require('chai')
const { network, deployments, ethers } = require('hardhat')
const { developmentChains } = require('../../helper-hardhat-config')

!developmentChains.includes(network.name)
  ? describe.skip
  : describe('Dynamic NFT Unit Tests', function () {
      let dynamicNft, deployer, vrfCoordinatorV2Mock

      beforeEach(async () => {
        accounts = await ethers.getSigners()
        deployer = accounts[0]
        await deployments.fixture(['mocks', 'dynamicnft'])
        dynamicNft = await ethers.getContract('DynamicNft')
        vrfCoordinatorV2Mock = await ethers.getContract('VRFCoordinatorV2Mock')
      })

      describe('constructor', () => {
        it('sets starting values correctly', async function () {
          const tokenUriZero = await dynamicNft.gettokenUris(0)
          const isInitialized = await dynamicNft.getInitialized()
          assert(tokenUriZero.includes('ipfs://'))
          assert.equal(isInitialized, true)
        })
      })

      describe('requestNft', () => {
        it("fails if payment isn't sent with the request", async function () {
          await expect(dynamicNft.requestNft()).to.be.revertedWith(
            'RandomIpfsNft__NeedMoreETHSent'
          )
        })
        it('reverts if payment amount is less than the mint fee', async function () {
          const fee = await dynamicNft.getMintFee()
          await expect(
            dynamicNft.requestNft({
              value: fee.sub(ethers.utils.parseEther('0.001')),
            })
          ).to.be.revertedWith('RandomIpfsNft__NeedMoreETHSent')
        })
        it('emits an event and kicks off a random word request', async function () {
          const fee = await dynamicNft.getMintFee()
          await expect(
            dynamicNft.requestNft({ value: fee.toString() })
          ).to.emit(dynamicNft, 'NftRequested')
        })
      })

      describe('fulfillRandomWords', () => {
        it('mints NFT after random number is returned', async function () {
          await new Promise(async (resolve, reject) => {
            dynamicNft.once('NftMinted', async () => {
              try {
                const tokenUri = await dynamicNft.tokenURI('0')
                const tokenCounter = await dynamicNft.getTokenCounter()
                assert.equal(tokenUri.toString().includes('ipfs://'), true)
                assert.equal(tokenCounter.toString(), '1')
                resolve()
              } catch (e) {
                console.log(e)
                reject(e)
              }
            })
            try {
              const fee = await dynamicNft.getMintFee()
              const requestNftResponse = await dynamicNft.requestNft({
                value: fee.toString(),
              })
              const requestNftReceipt = await requestNftResponse.wait(1)
              await vrfCoordinatorV2Mock.fulfillRandomWords(
                requestNftReceipt.events[1].args.requestId,
                dynamicNft.address
              )
            } catch (e) {
              console.log(e)
              reject(e)
            }
          })
        })
      })
    })
