import type { OAuthRegisteredClientsStore } from '@modelcontextprotocol/sdk/server/auth/clients.js';
import type { OAuthClientInformationFull } from '@modelcontextprotocol/sdk/shared/auth.js';
import { oauthFetch } from './oauth-fetch.js';

export class AgentCardClientsStore implements OAuthRegisteredClientsStore {
  async getClient(clientId: string): Promise<OAuthClientInformationFull | undefined> {
    const res = await oauthFetch(`/oauth/clients/${clientId}`);
    if (!res.ok) return undefined;

    const data = await res.json();
    return {
      client_id: data.clientId,
      client_secret: data.clientSecret ?? undefined,
      client_id_issued_at: data.clientIdIssuedAt,
      client_secret_expires_at: data.clientSecretExpiresAt ?? undefined,
      redirect_uris: JSON.parse(data.redirectUris),
      grant_types: JSON.parse(data.grantTypes),
      response_types: JSON.parse(data.responseTypes),
      client_name: data.clientName ?? undefined,
      token_endpoint_auth_method: data.tokenEndpointAuthMethod,
    };
  }

  async registerClient(
    client: Omit<OAuthClientInformationFull, 'client_id' | 'client_id_issued_at'>,
  ): Promise<OAuthClientInformationFull> {
    const clientId = crypto.randomUUID();
    const clientIdIssuedAt = Math.floor(Date.now() / 1000);

    const res = await oauthFetch('/oauth/clients', {
      method: 'POST',
      body: {
        clientId,
        clientSecret: client.client_secret,
        clientIdIssuedAt,
        clientSecretExpiresAt: client.client_secret_expires_at,
        redirectUris: client.redirect_uris,
        grantTypes: client.grant_types,
        responseTypes: client.response_types,
        clientName: client.client_name,
        tokenEndpointAuthMethod: client.token_endpoint_auth_method,
      },
    });

    if (!res.ok) {
      const err = await res.text();
      throw new Error(`Failed to register client: ${err}`);
    }

    return {
      ...client,
      client_id: clientId,
      client_id_issued_at: clientIdIssuedAt,
    };
  }
}
