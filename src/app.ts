import {
    type AuthenticationResponseJSON,
    type RegistrationResponseJSON,
    type WebAuthnCredential,
    generateAuthenticationOptions,
    generateRegistrationOptions,
    verifyAuthenticationResponse,
    verifyRegistrationResponse,
} from "@simplewebauthn/server";
import { type Context, Hono } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";

const app = new Hono();

app.use("*", logger());
app.use("*", cors({ credentials: true, origin: (origin) => origin || "*" }));

// credentials stored in memory, indexed by credential ID
const credentials = new Map<
    string,
    WebAuthnCredential & { publicKeyString: string }
>();

const getDomainName = async (c: Context) => {
    let rpID: string | undefined;
    if (c.req.raw.body) {
        const body = await c.req.json<{ rpID?: string }>();
        rpID = body.rpID;
    }
    // if there is custom rpID, use it first.
    if (rpID) {
        return rpID;
    }
    // use origin header at default
    const origin = c.req.header("origin");
    if (!origin) {
        return null;
    }
    return new URL(origin).hostname;
};

app.post("/register/options", async (c) => {
    const { username } = await c.req.json<{ username: string }>();
    const domainName = await getDomainName(c);
    if (!domainName) return c.text("Origin header is missing", 400);

    const options = await generateRegistrationOptions({
        rpName: domainName,
        rpID: domainName,
        userName: username,
        authenticatorSelection: {
            residentKey: "required",
            userVerification: "required",
        },
    });

    return c.json({ options, userId: options.user.id });
});

app.post("/register/verify", async (c) => {
    const { cred } = await c.req.json<{
        cred: RegistrationResponseJSON;
    }>();

    const domainName = await getDomainName(c);
    if (!domainName) return c.text("Origin header is missing", 400);

    const publicKeyString = cred.response.publicKey;
    if (!publicKeyString) {
        return c.text("Public key is missing", 400);
    }

    const clientData = JSON.parse(atob(cred.response.clientDataJSON));
    const origin = c.req.header("origin");
    const verification = await verifyRegistrationResponse({
        response: cred,
        expectedChallenge: clientData.challenge,
        expectedRPID: domainName,
        expectedOrigin: origin as string, //! Allow from any origin
        requireUserVerification: true,
    });

    if (verification.verified && verification.registrationInfo) {
        const { credential } = verification.registrationInfo;
        credentials.set(credential.id, {
            ...credential,
            publicKeyString,
        });
        return c.json(verification);
    }

    return c.text("Unauthorized", 401);
});

app.post("/login/options", async (c) => {
    const domainName = await getDomainName(c);
    if (!domainName) return c.text("Origin header is missing", 400);

    const options = await generateAuthenticationOptions({
        userVerification: "required",
        rpID: domainName,
    });

    return c.json(options);
});

app.post("/login/verify", async (c) => {
    try {
        const domainName = await getDomainName(c);
        if (!domainName) return c.text("Origin header is missing", 400);

        const { cred } = await c.req.json<{
            cred: AuthenticationResponseJSON;
        }>();

        const clientData = JSON.parse(atob(cred.response.clientDataJSON));

        const credential = credentials.get(cred.id);
        if (!credential)
            return c.json({ error: "Unauthorized" }, { status: 401 });

        const origin = c.req.header("origin");
        const verification = await verifyAuthenticationResponse({
            response: cred,
            expectedChallenge: clientData.challenge,
            expectedOrigin: origin as string, //! Allow from any origin
            expectedRPID: domainName,
            credential,
        });

        if (verification.verified) {
            const { newCounter } = verification.authenticationInfo;
            credential.counter = newCounter;
            return c.json({
                verification,
                pubkey: credential.publicKeyString,
            });
        }
        return c.text("Unauthorized", 401);
    } catch (error) {
        console.error(error);
        return c.text("Internal Server Error", 500);
    }
});

// health check
app.get("/health", (c) => c.json({ status: "ok" }));

export default app;
