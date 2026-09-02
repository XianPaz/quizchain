const { loadFixture } = require("@nomicfoundation/hardhat-toolbox/network-helpers");
const { expect } = require("chai");

const SESSION_A = "session-ethereum-2026-09-01";
const SESSION_B = "session-bitcoin-2026-09-02";

function podiumInput(overrides = {}) {
  return {
    sessionId: SESSION_A,
    quizName: "Ethereum",
    className: "6to A",
    date: "2026-09-01",
    rank: 1,
    qtkn: 21,
    correct: 8,
    totalQuestions: 10,
    nickname: "mati",
    ...overrides,
  };
}

function decodeTokenURI(uri) {
  const prefix = "data:application/json;base64,";
  expect(uri.startsWith(prefix), "tokenURI should be an on-chain data URI").to.equal(true);
  return JSON.parse(Buffer.from(uri.slice(prefix.length), "base64").toString("utf8"));
}

describe("QuizPodiumNFT", function () {
  async function deployFixture() {
    const [owner, professor, student, other, stranger] = await ethers.getSigners();
    const Factory = await ethers.getContractFactory("QuizPodiumNFT");
    const nft = await Factory.deploy();
    await nft.waitForDeployment();
    await nft.addMinter(professor.address);
    return { nft, owner, professor, student, other, stranger };
  }

  describe("permissions", function () {
    it("makes the deployer a minter and owner", async function () {
      const { nft, owner } = await loadFixture(deployFixture);
      expect(await nft.owner()).to.equal(owner.address);
      expect(await nft.minters(owner.address)).to.equal(true);
    });

    it("lets only the owner add and remove minters", async function () {
      const { nft, professor, stranger } = await loadFixture(deployFixture);

      await expect(nft.connect(stranger).addMinter(stranger.address))
        .to.be.revertedWithCustomError(nft, "OwnableUnauthorizedAccount")
        .withArgs(stranger.address);

      await expect(nft.connect(stranger).removeMinter(professor.address))
        .to.be.revertedWithCustomError(nft, "OwnableUnauthorizedAccount")
        .withArgs(stranger.address);

      await expect(nft.removeMinter(professor.address))
        .to.emit(nft, "MinterRemoved")
        .withArgs(professor.address);
      expect(await nft.minters(professor.address)).to.equal(false);

      await expect(nft.addMinter(professor.address))
        .to.emit(nft, "MinterAdded")
        .withArgs(professor.address);
      expect(await nft.minters(professor.address)).to.equal(true);
    });

    it("rejects the zero address as a minter", async function () {
      const { nft } = await loadFixture(deployFixture);
      await expect(nft.addMinter(ethers.ZeroAddress)).to.be.revertedWith("Invalid address");
    });
  });

  describe("minting", function () {
    it("lets an authorized minter mint a podium NFT", async function () {
      const { nft, professor, student } = await loadFixture(deployFixture);
      const input = podiumInput();

      await expect(nft.connect(professor).mintPodium(student.address, input))
        .to.emit(nft, "PodiumMinted")
        .withArgs(professor.address, student.address, 1, SESSION_A, 1);

      expect(await nft.ownerOf(1)).to.equal(student.address);
      expect(await nft.balanceOf(student.address)).to.equal(1);
      expect(await nft.hasPodium(SESSION_A, student.address)).to.equal(true);
      expect(await nft.tokenOf(SESSION_A, student.address)).to.equal(1n);

      const podium = await nft.podiumOf(1);
      expect(podium.sessionId).to.equal(SESSION_A);
      expect(podium.rank).to.equal(1);
      expect(podium.wallet).to.equal(student.address);
      expect(podium.nickname).to.equal("mati");
    });

    it("reverts when an unauthorized account mints", async function () {
      const { nft, student, stranger } = await loadFixture(deployFixture);
      await expect(
        nft.connect(stranger).mintPodium(student.address, podiumInput())
      ).to.be.revertedWith("Not an approved minter");
    });

    it("reverts after a minter is removed", async function () {
      const { nft, professor, student } = await loadFixture(deployFixture);
      await nft.removeMinter(professor.address);
      await expect(
        nft.connect(professor).mintPodium(student.address, podiumInput())
      ).to.be.revertedWith("Not an approved minter");
    });

    it("reverts when rank is not 1, 2 or 3", async function () {
      const { nft, professor, student } = await loadFixture(deployFixture);
      await expect(
        nft.connect(professor).mintPodium(student.address, podiumInput({ rank: 0 }))
      ).to.be.revertedWith("Invalid rank");
      await expect(
        nft.connect(professor).mintPodium(student.address, podiumInput({ rank: 4 }))
      ).to.be.revertedWith("Invalid rank");
    });

    it("increases supply with each mint", async function () {
      const { nft, professor, student, other } = await loadFixture(deployFixture);
      expect(await nft.totalSupply()).to.equal(0);

      await nft.connect(professor).mintPodium(student.address, podiumInput({ rank: 1 }));
      expect(await nft.totalSupply()).to.equal(1);

      await nft.connect(professor).mintPodium(other.address, podiumInput({ rank: 2 }));
      expect(await nft.totalSupply()).to.equal(2);
    });

    it("mints a batch of podium NFTs", async function () {
      const { nft, professor, student, other } = await loadFixture(deployFixture);
      await nft.connect(professor).mintPodiumBatch(
        [student.address, other.address],
        [podiumInput({ rank: 1 }), podiumInput({ rank: 2, nickname: "lu" })]
      );
      expect(await nft.totalSupply()).to.equal(2);
      expect((await nft.podiumOf(1)).rank).to.equal(1);
      expect((await nft.podiumOf(2)).rank).to.equal(2);
    });
  });

  describe("ties and uniqueness", function () {
    it("allows two golds in the same session (tie)", async function () {
      const { nft, professor, student, other } = await loadFixture(deployFixture);

      await nft.connect(professor).mintPodium(student.address, podiumInput({ rank: 1, nickname: "mati" }));
      await nft.connect(professor).mintPodium(other.address, podiumInput({ rank: 1, nickname: "lu" }));

      expect((await nft.podiumOf(1)).rank).to.equal(1);
      expect((await nft.podiumOf(2)).rank).to.equal(1);
      expect(await nft.totalSupply()).to.equal(2);
    });

    it("reverts a duplicate mint for the same student and session", async function () {
      const { nft, professor, student } = await loadFixture(deployFixture);
      await nft.connect(professor).mintPodium(student.address, podiumInput({ rank: 1 }));

      await expect(
        nft.connect(professor).mintPodium(student.address, podiumInput({ rank: 2 }))
      ).to.be.revertedWith("Already minted for session");
    });

    it("reverts a repeated distribution and allows a different session", async function () {
      const { nft, professor, student } = await loadFixture(deployFixture);
      await nft.connect(professor).mintPodium(student.address, podiumInput());

      await expect(
        nft.connect(professor).mintPodium(student.address, podiumInput())
      ).to.be.revertedWith("Already minted for session");

      await nft.connect(professor).mintPodium(
        student.address,
        podiumInput({ sessionId: SESSION_B, quizName: "Bitcoin", date: "2026-09-02", rank: 3 })
      );

      expect(await nft.totalSupply()).to.equal(2);
      expect(await nft.hasPodium(SESSION_A, student.address)).to.equal(true);
      expect(await nft.hasPodium(SESSION_B, student.address)).to.equal(true);
      expect((await nft.podiumOf(2)).sessionId).to.equal(SESSION_B);
      expect((await nft.podiumOf(2)).rank).to.equal(3);
    });
  });

  describe("soulbound transfers", function () {
    async function mintedFixture() {
      const ctx = await deployFixture();
      await ctx.nft.connect(ctx.professor).mintPodium(ctx.student.address, podiumInput());
      return ctx;
    }

    it("blocks transferFrom by the owner", async function () {
      const { nft, student, other } = await loadFixture(mintedFixture);
      await expect(
        nft.connect(student).transferFrom(student.address, other.address, 1)
      ).to.be.revertedWith("Soulbound");
      expect(await nft.ownerOf(1)).to.equal(student.address);
    });

    it("blocks approve + transferFrom", async function () {
      const { nft, student, other } = await loadFixture(mintedFixture);
      await nft.connect(student).approve(other.address, 1);
      expect(await nft.getApproved(1)).to.equal(other.address);

      await expect(
        nft.connect(other).transferFrom(student.address, other.address, 1)
      ).to.be.revertedWith("Soulbound");
      expect(await nft.ownerOf(1)).to.equal(student.address);
    });

    it("blocks safeTransferFrom", async function () {
      const { nft, student, other } = await loadFixture(mintedFixture);
      await expect(
        nft.connect(student)["safeTransferFrom(address,address,uint256)"](
          student.address,
          other.address,
          1
        )
      ).to.be.revertedWith("Soulbound");

      await expect(
        nft.connect(student)["safeTransferFrom(address,address,uint256,bytes)"](
          student.address,
          other.address,
          1,
          "0x"
        )
      ).to.be.revertedWith("Soulbound");
      expect(await nft.ownerOf(1)).to.equal(student.address);
    });
  });

  describe("metadata", function () {
    it("exposes podium fields on-chain and in tokenURI JSON", async function () {
      const { nft, professor, student } = await loadFixture(deployFixture);
      const input = podiumInput({
        rank: 2,
        qtkn: 18,
        correct: 7,
        totalQuestions: 10,
        nickname: "lu",
      });
      await nft.connect(professor).mintPodium(student.address, input);

      const podium = await nft.podiumOf(1);
      expect(podium.sessionId).to.equal(input.sessionId);
      expect(podium.quizName).to.equal(input.quizName);
      expect(podium.className).to.equal(input.className);
      expect(podium.date).to.equal(input.date);
      expect(podium.rank).to.equal(2);
      expect(podium.qtkn).to.equal(input.qtkn);
      expect(podium.correct).to.equal(input.correct);
      expect(podium.totalQuestions).to.equal(input.totalQuestions);
      expect(podium.nickname).to.equal(input.nickname);
      expect(podium.wallet).to.equal(student.address);
      expect(await nft.medalName(2)).to.equal("Plata");

      const meta = decodeTokenURI(await nft.tokenURI(1));
      expect(meta.puesto).to.equal("Plata");
      expect(meta.fecha).to.equal(input.date);
      expect(meta.clase).to.equal(input.className);
      expect(meta.quiz).to.equal(input.quizName);
      expect(meta.QTKN).to.equal("18");
      expect(meta.correctas).to.equal("7");
      expect(meta["total de preguntas"]).to.equal("10");
      expect(meta.nickname).to.equal("lu");
      expect(meta.wallet.toLowerCase()).to.equal(student.address.toLowerCase());
      expect(meta["session ID"]).to.equal(SESSION_A);
      expect(meta.image.startsWith("data:image/svg+xml;base64,")).to.equal(true);

      const svg = Buffer.from(meta.image.split(",")[1], "base64").toString("utf8");
      expect(svg).to.include(input.className);
      expect(svg).to.include(input.date);
      expect(svg).to.include("Plata");

      const traits = Object.fromEntries(meta.attributes.map((a) => [a.trait_type, a.value]));
      expect(traits.puesto).to.equal("Plata");
      expect(traits.fecha).to.equal(input.date);
      expect(traits.clase).to.equal(input.className);
      expect(traits.quiz).to.equal(input.quizName);
      expect(traits.QTKN).to.equal("18");
      expect(traits.correctas).to.equal("7");
      expect(traits["total de preguntas"]).to.equal("10");
      expect(traits.nickname).to.equal("lu");
      expect(traits.wallet.toLowerCase()).to.equal(student.address.toLowerCase());
      expect(traits["session ID"]).to.equal(SESSION_A);
    });

    it("escapes XML in the SVG so a class name cannot break the image", async function () {
      const { nft, professor, student, other } = await loadFixture(deployFixture);

      await nft.connect(professor).mintPodium(
        student.address,
        podiumInput({ className: "Fisica & Quimica", date: "2026-09-01" })
      );
      const plain = decodeTokenURI(await nft.tokenURI(1));
      const plainSvg = Buffer.from(plain.image.split(",")[1], "base64").toString("utf8");
      expect(plainSvg).to.include("Fisica &amp; Quimica");
      expect(plainSvg).to.not.include("Fisica & Quimica");
      // The JSON keeps the real text; only the image markup is escaped.
      expect(plain.clase).to.equal("Fisica & Quimica");

      const hostile = "</text><script>alert(1)</script><text x='0'>";
      await nft.connect(professor).mintPodium(
        other.address,
        podiumInput({ sessionId: SESSION_B, className: hostile, date: '2026-"09"-01' })
      );
      const meta = decodeTokenURI(await nft.tokenURI(2));
      const svg = Buffer.from(meta.image.split(",")[1], "base64").toString("utf8");
      expect(svg).to.not.include("<script>");
      expect(svg).to.not.include("</text><script>");
      expect(svg).to.include("&lt;script&gt;");
      expect(svg).to.include("&apos;0&apos;");
      expect(svg).to.include("&quot;09&quot;");
      // Every angle bracket left in the image is real SVG markup, not user text.
      expect((svg.match(/<text /g) || []).length).to.equal(3);
      expect(meta.clase).to.equal(hostile);
    });

    it("refuses control bytes that no JSON or XML reader can carry", async function () {
      const { nft, professor, student, other } = await loadFixture(deployFixture);

      // OpenZeppelin's escapeJSON does not escape these, so the metadata JSON would
      // be unparseable for good on a token that can never be re-minted.
      for (const bad of ["6to\u0000 A", "6to\u000b A", "6to\u001f A"]) {
        await expect(
          nft.connect(professor).mintPodium(student.address, podiumInput({ className: bad }))
        ).to.be.revertedWith("Unprintable character");
      }
      await expect(
        nft.connect(professor).mintPodium(student.address, podiumInput({ date: "2026\u0007" }))
      ).to.be.revertedWith("Unprintable character");

      // Tab and newline are legal in both formats and still mint.
      await nft.connect(professor).mintPodium(
        other.address,
        podiumInput({ className: "6to\tA\nB" })
      );
      const meta = decodeTokenURI(await nft.tokenURI(1));
      expect(meta.clase).to.equal("6to\tA\nB");
    });
  });
});
