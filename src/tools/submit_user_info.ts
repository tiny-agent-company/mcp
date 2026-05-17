import { mcpFetch } from '../lib/mcp-fetch.js';

export const submitUserInfoDefinition = {
  name: 'submit_user_info',
  description:
    'Submit phone number and terms acceptance required before creating your first virtual card. Call this after create_card returns a user_info_required response. Name and date of birth are collected automatically during identity verification (KYC).',
  inputSchema: {
    type: 'object' as const,
    properties: {
      phone_number: {
        type: 'string',
        description: "User's phone number (e.g. +1-555-123-4567)",
      },
      terms_accepted: {
        type: 'boolean',
        description:
          'Must be true — indicates the user has accepted the AgentCard cardholder terms of service',
      },
    },
    required: ['phone_number', 'terms_accepted'],
  },
};

export async function submitUserInfo(
  args: {
    phone_number: string;
    terms_accepted: boolean;
  },
  jwt: string,
) {
  const res = await mcpFetch('/cards/user-info', jwt, {
    method: 'POST',
    body: JSON.stringify({
      phoneNumber: args.phone_number,
      termsAccepted: args.terms_accepted,
    }),
  });

  if (!res.ok) {
    throw new Error(`API error ${res.status}: ${await res.text()}`);
  }

  return {
    content: [
      {
        type: 'text' as const,
        text: 'User information saved successfully. You can now call create_card to issue a virtual card.',
      },
    ],
  };
}
