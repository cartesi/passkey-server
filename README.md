# Passkey Server for ZeroDev Kernel

This project is minimal in-memory passkey server to be used with ZeroDev passkey applications.

It implements the protocol expected by the [@zerodev/webauthn-key](https://www.npmjs.com/package/@zerodev/webauthn-key) library.

The protocol is not formally specified but there is some [documentation](https://docs.zerodev.app/sdk/advanced/passkeys#how-do-i-use-my-own-passkeys-server) about it.

## Prerequisites

Before running the application, ensure you have the following installed:

-   [pnpm](https://pnpm.io/)

## Installation

To set up the project, clone the repository and install dependencies:

```bash
git clone git@github.com:cartesi/passkey-server.git
cd passkey-server
pnpm i
```

## Running the Application

To start the server, run the following command:

```bash
pnpm run dev
```

This will start the server on the default port. To select a different port use the `--port` option.

The server does not use any persistence to store credentials.
So if you try to login with an existing passkey stored in your device, but that has not been registered with the passkey-server it won't work.
