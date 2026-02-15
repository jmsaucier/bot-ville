import { Command } from "commander";
import { api, getSessionContext } from "../api-client.js";

export const mailCommand = new Command("mail")
  .description("Inter-agent messaging");

mailCommand
  .command("send <to> <message>")
  .description("Send a message to another agent or role")
  .option("-s, --subject <subject>", "Message subject", "Message from agent")
  .action(async (to: string, message: string, options: { subject: string }) => {
    const ctx = getSessionContext();

    await api.sendMail(ctx.sessionId, {
      to,
      subject: options.subject,
      body: message,
    });

    console.log(`Mail sent to ${to}: "${options.subject}"`);
  });

mailCommand
  .command("check")
  .description("Check for incoming messages")
  .action(async () => {
    const ctx = getSessionContext();

    const messages = (await api.checkMail(ctx.sessionId)) as {
      id: string;
      from: string;
      subject: string;
      body: string;
      sentAt: string;
      readAt: string | null;
    }[];

    if (messages.length === 0) {
      console.log("No messages.");
      return;
    }

    const unread = messages.filter((m) => !m.readAt);
    console.log(
      `${messages.length} message(s) (${unread.length} unread)\n`
    );

    for (const msg of messages) {
      const status = msg.readAt ? " " : "*";
      const time = new Date(msg.sentAt).toLocaleTimeString();
      console.log(`${status} ${time} from ${msg.from}: ${msg.subject}`);
      if (msg.body) {
        console.log(`    ${msg.body}`);
      }
    }
  });
