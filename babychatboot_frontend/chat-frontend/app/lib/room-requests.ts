/** Prevent a response for a previous room or an older read from replacing the current conversation. */
export class RoomRequests {
  private room: string | null = null;
  private revision = 0;
  select(room: string) { this.room = room; this.revision++; }
  current() { return this.room; }
  begin(room: string) { return { room, revision: ++this.revision }; }
  accepts(ticket: { room: string; revision: number }) {
    return ticket.room === this.room && ticket.revision === this.revision;
  }
}
