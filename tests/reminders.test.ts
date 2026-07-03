import test from "node:test";
import assert from "node:assert/strict";
import { signupUser } from "../app/auth/auth";
import { createReminder, listReminders, markReminderCompleted } from "../app/lib/data/reminders";

test("reminders can be created, listed, and completed", async () => {
  const user = await signupUser({
    name: "Reminder User",
    email: `reminders-${Date.now()}@example.com`,
    password: "password123",
  });

  const created = await createReminder({
    userId: user.user.id,
    title: "Ship MVP",
    message: "Finish the collaboration MVP",
    dueAt: new Date(Date.now() + 60_000).toISOString(),
  });

  const reminders = await listReminders(user.user.id);
  const completed = await markReminderCompleted(created.id);

  assert.equal(created.title, "Ship MVP");
  assert.equal(reminders.length, 1);
  assert.equal(completed.isCompleted, true);
});
