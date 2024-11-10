
# Exactly Stacking Contracts


# Q&A

### Q: On what chains are the smart contracts going to be deployed?
op mainnet
___

### Q: If you are integrating tokens, are you allowing only whitelisted tokens to work with the codebase or any complying with the standard? Are they assumed to have certain properties, e.g. be non-reentrant? Are there any types of [weird tokens](https://github.com/d-xo/weird-erc20) you want to integrate?
only fully ERC-20 compliant tokens without weird traits.
___

### Q: Are there any limitations on values set by admins (or other roles) in the codebase, including restrictions on array lengths?
no
___

### Q: Are there any limitations on values set by admins (or other roles) in protocols you integrate with, including restrictions on array lengths?
no
___

### Q: For permissioned functions, please list all checks and requirements that will be made before calling the function.
n/a
___

### Q: Is the codebase expected to comply with any EIPs? Can there be/are there any deviations from the specification?
ERC-20 strict compliance (stEXA)
___

### Q: Are there any off-chain mechanisms or off-chain procedures for the protocol (keeper bots, arbitrage bots, etc.)?
no
___

### Q: Are there any hardcoded values that you intend to change before (some) deployments?
no
___

### Q: If the codebase is to be deployed on an L2, what should be the behavior of the protocol in case of sequencer issues (if applicable)? Should Sherlock assume that the Sequencer won't misbehave, including going offline?
assume the sequencer won't misbehave
___

### Q: Should potential issues, like broken assumptions about function behavior, be reported if they could pose risks in future integrations, even if they might not be an issue in the context of the scope? If yes, can you elaborate on properties/invariants that should hold?
no
___

### Q: Please discuss any design choices you made.
n/a
___

### Q: Please list any known issues and explicitly state the acceptable risks for each known issue.
n/a
___

### Q: We will report issues where the core protocol functionality is inaccessible for at least 7 days. Would you like to override this value?
n/a
___

### Q: Please list any relevant protocol resources.
https://docs.exact.ly
___

