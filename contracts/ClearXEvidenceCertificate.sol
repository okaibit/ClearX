// SPDX-License-Identifier: MIT

pragma solidity ^0.8.30;

/// @notice Cryptographic certificate for independently verified ClearX evidence.
/// Two authorized signers must attest to the exact same execution evidence.
contract ClearXEvidenceCertificate {
    bytes32 public constant EVIDENCE_TYPEHASH =
        keccak256(
            "EvidenceCertificate(uint256 jobId,uint256 chainId,address commerce,bytes32 transactionHash,address recipient,uint256 amount,bytes32 evidenceHash)"
        );

    bytes32 public immutable DOMAIN_SEPARATOR;

    address[] public signers;
    mapping(address => bool) public isSigner;

    uint256 public immutable threshold;

    mapping(bytes32 => bool) public certificateVerified;

    error UnauthorizedSigner();
    error InvalidThreshold();
    error InvalidSignature();
    error DuplicateSigner();
    error CertificateAlreadyVerified();

    event EvidenceCertificateVerified(
        bytes32 indexed certificateId,
        uint256 indexed jobId,
        bytes32 indexed transactionHash,
        address recipient,
        uint256 amount,
        bytes32 evidenceHash,
        uint256 signerCount
    );

    constructor(
        address[] memory signers_,
        uint256 threshold_
    ) {
        if (threshold_ == 0 || threshold_ > signers_.length) {
            revert InvalidThreshold();
        }

        threshold = threshold_;

        for (uint256 i = 0; i < signers_.length; i++) {
            address signer = signers_[i];

            if (signer == address(0)) {
                revert UnauthorizedSigner();
            }

            if (isSigner[signer]) {
                revert DuplicateSigner();
            }

            isSigner[signer] = true;
            signers.push(signer);
        }

        DOMAIN_SEPARATOR = keccak256(
            abi.encode(
                keccak256(
                    "EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)"
                ),
                keccak256(bytes("ClearX Evidence Certificate")),
                keccak256(bytes("1")),
                block.chainid,
                address(this)
            )
        );
    }

    function certificateDigest(
        uint256 jobId,
        uint256 chainId,
        address commerce,
        bytes32 transactionHash,
        address recipient,
        uint256 amount,
        bytes32 evidenceHash
    ) public view returns (bytes32) {
        bytes32 structHash = keccak256(
            abi.encode(
                EVIDENCE_TYPEHASH,
                jobId,
                chainId,
                commerce,
                transactionHash,
                recipient,
                amount,
                evidenceHash
            )
        );

        return keccak256(
            abi.encodePacked(
                "\x19\x01",
                DOMAIN_SEPARATOR,
                structHash
            )
        );
    }

    function verifyCertificate(
        uint256 jobId,
        uint256 chainId,
        address commerce,
        bytes32 transactionHash,
        address recipient,
        uint256 amount,
        bytes32 evidenceHash,
        bytes[] calldata signatures
    ) external returns (bytes32 certificateId) {
        certificateId = certificateDigest(
            jobId,
            chainId,
            commerce,
            transactionHash,
            recipient,
            amount,
            evidenceHash
        );

        if (certificateVerified[certificateId]) {
            revert CertificateAlreadyVerified();
        }

        if (signatures.length < threshold) {
            revert InvalidSignature();
        }

        address previousSigner = address(0);
        uint256 validSignatures;

        for (uint256 i = 0; i < signatures.length; i++) {
            address recovered = _recover(
                certificateId,
                signatures[i]
            );

            if (!isSigner[recovered]) {
                revert UnauthorizedSigner();
            }

            // Require signatures to be supplied in strictly increasing
            // signer-address order, preventing duplicate signatures.
            if (
                previousSigner != address(0) &&
                recovered <= previousSigner
            ) {
                revert InvalidSignature();
            }

            previousSigner = recovered;
            validSignatures++;
        }

        if (validSignatures < threshold) {
            revert InvalidSignature();
        }

        certificateVerified[certificateId] = true;

        emit EvidenceCertificateVerified(
            certificateId,
            jobId,
            transactionHash,
            recipient,
            amount,
            evidenceHash,
            validSignatures
        );
    }

    function signerCount() external view returns (uint256) {
        return signers.length;
    }

    function _recover(
        bytes32 digest,
        bytes calldata signature
    ) internal pure returns (address) {
        if (signature.length != 65) {
            revert InvalidSignature();
        }

        bytes32 r;
        bytes32 s;
        uint8 v;

        assembly {
            r := calldataload(signature.offset)
            s := calldataload(add(signature.offset, 32))
            v := byte(0, calldataload(add(signature.offset, 64)))
        }

        if (v < 27) {
            v += 27;
        }

        if (v != 27 && v != 28) {
            revert InvalidSignature();
        }

        address recovered = ecrecover(digest, v, r, s);

        if (recovered == address(0)) {
            revert InvalidSignature();
        }

        return recovered;
    }
}
