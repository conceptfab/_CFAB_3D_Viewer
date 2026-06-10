import { describe, it, expect, vi } from 'vitest';
import { buildLoginEmail, sendLoginCode } from './email';

describe('buildLoginEmail', () => {
  it('zawiera kod w treści wiadomości', () => {
    const { text, html } = buildLoginEmail('123456', 'http://localhost:3000');
    expect(text).toContain('123456');
    expect(html).toContain('123456');
  });

  it('zawiera APP_URL w treści', () => {
    const { text, html } = buildLoginEmail('000000', 'https://app.example.com');
    expect(text).toContain('https://app.example.com');
    expect(html).toContain('https://app.example.com');
  });

  it('zawiera informację o czasie ważności (15 minut)', () => {
    const { text } = buildLoginEmail('123456', 'http://localhost:3000');
    expect(text).toContain('15');
  });

  it('escapuje znaki HTML w appUrl (brak wstrzyknięcia znaczników)', () => {
    const { html } = buildLoginEmail('123456', 'https://x/"><script>alert(1)</script>');
    expect(html).not.toContain('<script>');
    expect(html).toContain('&lt;script&gt;');
    expect(html).toContain('&quot;');
  });
});

describe('sendLoginCode', () => {
  it('wywołuje transport.sendMail z poprawnym adresem odbiorcy', async () => {
    const mockTransport = {
      sendMail: vi.fn().mockResolvedValue({ messageId: 'test-id' }),
    };

    await sendLoginCode('user@example.com', '654321', {
      transport: mockTransport as any,
      from: 'Test Sender <no-reply@test.com>',
      appUrl: 'http://localhost:3000',
    });

    expect(mockTransport.sendMail).toHaveBeenCalledTimes(1);
    const callArg = mockTransport.sendMail.mock.calls[0][0];
    expect(callArg.to).toBe('user@example.com');
    expect(callArg.from).toBe('Test Sender <no-reply@test.com>');
  });

  it('wywołuje sendMail z kodem w treści', async () => {
    const mockTransport = {
      sendMail: vi.fn().mockResolvedValue({ messageId: 'x' }),
    };

    await sendLoginCode('u@e.com', '111222', {
      transport: mockTransport as any,
      from: 'App <a@b.com>',
      appUrl: 'http://localhost:3000',
    });

    const callArg = mockTransport.sendMail.mock.calls[0][0];
    expect(callArg.text).toContain('111222');
    expect(callArg.html).toContain('111222');
  });
});
