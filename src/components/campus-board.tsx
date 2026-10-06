"use client";

import Link from "next/link";
import { ConversationFeed, MemberHeader, MemberIntro, type MemberProfile } from "./member-ui";

export function CampusBoard({ user }: { user: MemberProfile }) {
  return <><MemberHeader user={user} active="board" /><main id="main-content" className="member-layout wrap"><MemberIntro user={user} label="Your college notice board" title="A shared space for your campus.">All signed-in members of your college can read notices and reply. Private help requests stay on the Helper dashboard.</MemberIntro>{user.role === "POSTER" && <div className="notice-board-actions"><Link href="/poster" className="button button-dark">Open Notice Board Form ↗</Link><span className="field-hint">One notice per day. Reply to conversations whenever you have something useful to share.</span></div>}<section className="member-section" aria-labelledby="board-feed"><h2 id="board-feed">College notices</h2><ConversationFeed kind="notice" user={user} /></section></main></>;
}
