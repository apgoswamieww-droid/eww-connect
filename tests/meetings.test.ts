import test from "node:test";
import assert from "node:assert/strict";
import prisma from "../app/lib/prisma";
import { signupUser } from "../app/auth/auth";
import { createMeeting, listMeetings } from "../app/meetings/meetings";

test("meetings can be created and listed for an organization", async () => {
  const user = await signupUser({
    name: "Meeting User",
    email: `meetings-${Date.now()}@example.com`,
    password: "password123",
  });

  const organization = await prisma.organization.findFirst({
    where: { users: { some: { id: user.user.id } } },
  });
  assert.ok(organization);

  const meeting = await createMeeting({
    organizationId: organization!.id,
    title: "Sprint Planning",
    description: "Plan the sprint",
    startTime: new Date(Date.now() + 60_000).toISOString(),
    endTime: new Date(Date.now() + 3_600_000).toISOString(),
    createdById: user.user.id,
    participantIds: [user.user.id],
  });

  const meetings = await listMeetings(organization!.id);

  assert.equal(meeting.title, "Sprint Planning");
  assert.equal(meetings.length, 1);
});
