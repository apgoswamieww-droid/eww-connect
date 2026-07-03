import test from "node:test";
import assert from "node:assert/strict";
import prisma from "../app/lib/prisma";
import { signupUser } from "../app/auth/auth";
import { createChannel, createTeam, listChannels, listTeams } from "../app/lib/data/channels";

test("teams and channels can be created and listed", async () => {
  const user = await signupUser({
    name: "Channel User",
    email: `channels-${Date.now()}@example.com`,
    password: "password123",
  });

  const organization = await prisma.organization.findFirst({
    where: { users: { some: { id: user.user.id } } },
  });
  assert.ok(organization);

  const team = await createTeam({
    organizationId: organization!.id,
    name: "Engineering",
    description: "Core engineering team",
  });

  const channel = await createChannel({
    teamId: team.id,
    name: "general",
    type: "PUBLIC",
  });

  const teams = await listTeams(organization!.id);
  const channels = await listChannels(team.id);

  assert.equal(team.name, "Engineering");
  assert.equal(channel.name, "general");
  assert.equal(teams.length, 1);
  assert.equal(channels.length, 1);
});
