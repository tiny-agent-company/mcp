import { randomBytes } from 'crypto';
import type { Response } from 'express';
import type {
  OAuthServerProvider,
  AuthorizationParams,
} from '@modelcontextprotocol/sdk/server/auth/provider.js';
import type { OAuthClientInformationFull, OAuthTokens, OAuthTokenRevocationRequest } from '@modelcontextprotocol/sdk/shared/auth.js';
import type { AuthInfo } from '@modelcontextprotocol/sdk/server/auth/types.js';
import { AgentCardClientsStore } from './clients-store.js';
import { oauthFetch } from './oauth-fetch.js';
import { getConsentHtml } from './consent.js';

export class AgentCardOAuthProvider implements OAuthServerProvider {
  private _clientsStore = new AgentCardClientsStore();

  get clientsStore(): AgentCardClientsStore {
    return this._clientsStore;
  }

  async authorize(
    client: OAuthClientInformationFull,
    params: AuthorizationParams,
    res: Response,
  ): Promise<void> {
    // Create pending auth session in backend
    const backendRes = await oauthFetch('/oauth/pending', {
      method: 'POST',
      body: {
        clientId: client.client_id,
        redirectUri: params.redirectUri,
        codeChallenge: params.codeChallenge,
        state: params.state,
        scopes: params.scopes,
      },
    });

    if (!backendRes.ok) {
      const err = await backendRes.text();
      res.status(500).send(`Failed to create auth session: ${err}`);
      return;
    }

    const pending = await backendRes.json();

    // Serve consent page
    res.setHeader('Content-Type', 'text/html');
    res.send(getConsentHtml(pending.id));
  }

  async challengeForAuthorizationCode(
    _client: OAuthClientInformationFull,
    authorizationCode: string,
  ): Promise<string> {
    const res = await oauthFetch(`/oauth/codes/${authorizationCode}`);
    if (!res.ok) {
      throw new Error('Authorization code not found');
    }
    const data = await res.json();
    return data.codeChallenge;
  }

  async exchangeAuthorizationCode(
    client: OAuthClientInformationFull,
    authorizationCode: string,
  ): Promise<OAuthTokens> {
    // Exchange code -> get userId
    const exchangeRes = await oauthFetch(`/oauth/codes/${authorizationCode}/exchange`, {
      method: 'POST',
    });

    if (!exchangeRes.ok) {
      const err = await exchangeRes.json().catch(() => ({}));
      throw new Error((err as { error?: string }).error || 'Code exchange failed');
    }

    const { userId } = await exchangeRes.json();

    // Generate opaque tokens
    const accessToken = randomBytes(32).toString('hex');
    const refreshToken = randomBytes(32).toString('hex');
    const expiresInSeconds = 3600; // 1 hour

    // Store tokens
    const storeRes = await oauthFetch('/oauth/tokens', {
      method: 'POST',
      body: {
        accessToken,
        refreshToken,
        clientId: client.client_id,
        userId,
        expiresInSeconds,
      },
    });

    if (!storeRes.ok) {
      throw new Error('Failed to store tokens');
    }

    return {
      access_token: accessToken,
      token_type: 'bearer',
      expires_in: expiresInSeconds,
      refresh_token: refreshToken,
    };
  }

  async exchangeRefreshToken(
    _client: OAuthClientInformationFull,
    refreshToken: string,
  ): Promise<OAuthTokens> {
    const newAccessToken = randomBytes(32).toString('hex');
    const newRefreshToken = randomBytes(32).toString('hex');
    const expiresInSeconds = 3600;

    const res = await oauthFetch('/oauth/tokens/refresh', {
      method: 'POST',
      body: {
        refreshToken,
        newAccessToken,
        newRefreshToken,
        expiresInSeconds,
      },
    });

    if (!res.ok) {
      throw new Error('Invalid refresh token');
    }

    return {
      access_token: newAccessToken,
      token_type: 'bearer',
      expires_in: expiresInSeconds,
      refresh_token: newRefreshToken,
    };
  }

  async verifyAccessToken(token: string): Promise<AuthInfo> {
    const res = await oauthFetch('/oauth/tokens/verify', {
      headers: { 'x-access-token': token },
    });

    if (!res.ok) {
      throw new Error('Invalid or expired token');
    }

    const data = await res.json();
    return {
      token,
      clientId: data.clientId,
      scopes: data.scope ? data.scope.split(' ') : [],
      extra: { userId: data.userId },
    };
  }

  async revokeToken(
    _client: OAuthClientInformationFull,
    request: OAuthTokenRevocationRequest,
  ): Promise<void> {
    await oauthFetch('/oauth/tokens/revoke', {
      method: 'POST',
      body: {
        token: request.token,
        tokenTypeHint: request.token_type_hint,
      },
    });
  }
}
