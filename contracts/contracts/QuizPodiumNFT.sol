// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {ERC721} from "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {Base64} from "@openzeppelin/contracts/utils/Base64.sol";
import {Strings} from "@openzeppelin/contracts/utils/Strings.sol";

/// @title QuizPodiumNFT
/// @notice Soulbound ERC-721 for quiz podium finishes (gold / silver / bronze).
/// @dev Transfers between non-zero addresses revert. Mint from address(0) is allowed.
contract QuizPodiumNFT is ERC721, Ownable {
    using Strings for uint256;

    struct PodiumInput {
        string sessionId;
        string quizName;
        string className;
        string date;
        uint8 rank;
        uint256 qtkn;
        uint256 correct;
        uint256 totalQuestions;
        string nickname;
    }

    struct Podium {
        string sessionId;
        string quizName;
        string className;
        string date;
        uint8 rank;
        uint256 qtkn;
        uint256 correct;
        uint256 totalQuestions;
        string nickname;
        address wallet;
    }

    mapping(address => bool) public minters;
    mapping(uint256 => Podium) private _podiums;
    mapping(bytes32 => uint256) private _tokenBySessionStudent;

    uint256 private _nextTokenId = 1;

    event MinterAdded(address indexed minter);
    event MinterRemoved(address indexed minter);
    event PodiumMinted(
        address indexed minter,
        address indexed student,
        uint256 indexed tokenId,
        string sessionId,
        uint8 rank
    );

    modifier onlyMinter() {
        require(minters[msg.sender], "Not an approved minter");
        _;
    }

    constructor() ERC721("QuizPodium", "QPOD") Ownable(msg.sender) {
        minters[msg.sender] = true;
        emit MinterAdded(msg.sender);
    }

    function addMinter(address minter) external onlyOwner {
        require(minter != address(0), "Invalid address");
        minters[minter] = true;
        emit MinterAdded(minter);
    }

    function removeMinter(address minter) external onlyOwner {
        minters[minter] = false;
        emit MinterRemoved(minter);
    }

    function mintPodium(address to, PodiumInput calldata input) external onlyMinter returns (uint256) {
        return _mintPodium(to, input);
    }

    function mintPodiumBatch(
        address[] calldata recipients,
        PodiumInput[] calldata inputs
    ) external onlyMinter returns (uint256[] memory tokenIds) {
        require(recipients.length == inputs.length, "Length mismatch");
        tokenIds = new uint256[](recipients.length);
        for (uint256 i = 0; i < recipients.length; i++) {
            tokenIds[i] = _mintPodium(recipients[i], inputs[i]);
        }
    }

    function totalSupply() public view returns (uint256) {
        return _nextTokenId - 1;
    }

    function podiumOf(uint256 tokenId) public view returns (Podium memory) {
        _requireOwned(tokenId);
        return _podiums[tokenId];
    }

    function hasPodium(string calldata sessionId, address student) public view returns (bool) {
        return _tokenBySessionStudent[_sessionKey(sessionId, student)] != 0;
    }

    function tokenOf(string calldata sessionId, address student) public view returns (uint256) {
        return _tokenBySessionStudent[_sessionKey(sessionId, student)];
    }

    function medalName(uint8 rank) public pure returns (string memory) {
        if (rank == 1) return "Oro";
        if (rank == 2) return "Plata";
        if (rank == 3) return "Bronce";
        revert("Invalid rank");
    }

    function tokenURI(uint256 tokenId) public view override returns (string memory) {
        _requireOwned(tokenId);
        return string.concat("data:application/json;base64,", Base64.encode(bytes(_tokenJSON(tokenId))));
    }

    /// @dev Block peer-to-peer transfers. Mint (from == 0) and burn (to == 0) stay allowed.
    function _update(address to, uint256 tokenId, address auth) internal override returns (address) {
        address from = _ownerOf(tokenId);
        if (from != address(0) && to != address(0)) {
            revert("Soulbound");
        }
        return super._update(to, tokenId, auth);
    }

    function _mintPodium(address to, PodiumInput calldata input) internal returns (uint256 tokenId) {
        require(to != address(0), "Invalid address");
        require(bytes(input.sessionId).length != 0, "Empty sessionId");
        require(input.rank >= 1 && input.rank <= 3, "Invalid rank");

        bytes32 key = _sessionKey(input.sessionId, to);
        require(_tokenBySessionStudent[key] == 0, "Already minted for session");

        tokenId = _nextTokenId++;
        _tokenBySessionStudent[key] = tokenId;
        _podiums[tokenId] = Podium({
            sessionId: input.sessionId,
            quizName: input.quizName,
            className: input.className,
            date: input.date,
            rank: input.rank,
            qtkn: input.qtkn,
            correct: input.correct,
            totalQuestions: input.totalQuestions,
            nickname: input.nickname,
            wallet: to
        });

        _safeMint(to, tokenId);
        emit PodiumMinted(msg.sender, to, tokenId, input.sessionId, input.rank);
    }

    function _sessionKey(string memory sessionId, address student) internal pure returns (bytes32) {
        return keccak256(abi.encode(sessionId, student));
    }

    function _tokenJSON(uint256 tokenId) internal view returns (string memory) {
        return string.concat(
            _jsonHead(tokenId),
            ",",
            _jsonIdentity(tokenId),
            ",",
            _jsonScores(tokenId),
            ',"attributes":[',
            _jsonAttrsIdentity(tokenId),
            ",",
            _jsonAttrsScores(tokenId),
            "]}"
        );
    }

    function _jsonHead(uint256 tokenId) internal view returns (string memory) {
        string memory medal = medalName(_podiums[tokenId].rank);
        return string.concat(
            "{",
            _field("name", string.concat("QuizChain ", medal)),
            ",",
            _field("description", "NFT de podio no transferible"),
            ",",
            '"image":"',
            _imageURI(tokenId),
            '"'
        );
    }

    function _jsonIdentity(uint256 tokenId) internal view returns (string memory) {
        Podium storage p = _podiums[tokenId];
        return string.concat(
            _field("puesto", medalName(p.rank)),
            ",",
            _field("fecha", p.date),
            ",",
            _field("clase", p.className),
            ",",
            _field("quiz", p.quizName),
            ",",
            _field("nickname", p.nickname)
        );
    }

    function _jsonScores(uint256 tokenId) internal view returns (string memory) {
        Podium storage p = _podiums[tokenId];
        return string.concat(
            _field("QTKN", p.qtkn.toString()),
            ",",
            _field("correctas", p.correct.toString()),
            ",",
            _field("total de preguntas", p.totalQuestions.toString()),
            ",",
            _field("wallet", Strings.toHexString(p.wallet)),
            ",",
            _field("session ID", p.sessionId)
        );
    }

    function _jsonAttrsIdentity(uint256 tokenId) internal view returns (string memory) {
        Podium storage p = _podiums[tokenId];
        return string.concat(
            _attr("puesto", medalName(p.rank)),
            ",",
            _attr("fecha", p.date),
            ",",
            _attr("clase", p.className),
            ",",
            _attr("quiz", p.quizName),
            ",",
            _attr("nickname", p.nickname)
        );
    }

    function _jsonAttrsScores(uint256 tokenId) internal view returns (string memory) {
        Podium storage p = _podiums[tokenId];
        return string.concat(
            _attr("QTKN", p.qtkn.toString()),
            ",",
            _attr("correctas", p.correct.toString()),
            ",",
            _attr("total de preguntas", p.totalQuestions.toString()),
            ",",
            _attr("wallet", Strings.toHexString(p.wallet)),
            ",",
            _attr("session ID", p.sessionId)
        );
    }

    function _imageURI(uint256 tokenId) internal view returns (string memory) {
        Podium storage p = _podiums[tokenId];
        string memory svg = string.concat(
            "<svg xmlns='http://www.w3.org/2000/svg' width='600' height='600'>",
            "<rect width='100%' height='100%' fill='",
            p.rank == 1 ? "#D4AF37" : (p.rank == 2 ? "#C0C0C0" : "#CD7F32"),
            "'/>",
            "<text x='50%' y='38%' text-anchor='middle' font-size='48'>",
            medalName(p.rank),
            "</text><text x='50%' y='54%' text-anchor='middle' font-size='24'>",
            p.className,
            "</text><text x='50%' y='64%' text-anchor='middle' font-size='24'>",
            p.date,
            "</text></svg>"
        );
        return string.concat("data:image/svg+xml;base64,", Base64.encode(bytes(svg)));
    }

    function _field(string memory key, string memory value) internal pure returns (string memory) {
        return string.concat('"', key, '":"', Strings.escapeJSON(value), '"');
    }

    function _attr(string memory trait, string memory value) internal pure returns (string memory) {
        return string.concat('{"trait_type":"', trait, '","value":"', Strings.escapeJSON(value), '"}');
    }
}
