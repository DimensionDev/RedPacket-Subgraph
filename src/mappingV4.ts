import { BigInt } from "@graphprotocol/graph-ts";
import { fetchToken } from "./helpers";
import {
  ClaimSuccess,
  CreationSuccess,
  RefundSuccess
} from "../generated/RedPacketV4/RedPacketV4";
import {
  Claimer,
  Creator,
  RedPacket,
  RedPacketInfo,
} from "../generated/schema";
import {
  CHAIN_ID
} from "./constants";

export function handleCreationSuccess(event: CreationSuccess): void {
  let txHash = event.transaction.hash.toHexString();
  let red_packet_info = new RedPacketInfo(txHash);

  // create creator
  let creator_addr = event.transaction.from.toHexString();
  let creator = Creator.load(creator_addr);  
  if (creator == null) {
    creator = new Creator(creator_addr);
  }
  creator.address = event.transaction.from;
  creator.name = event.params.name;
  creator.save();

  // create token
  let token = fetchToken(event.params.token_address);
  token.save();

  red_packet_info.rpid = event.params.id.toHexString();
  red_packet_info.message = event.params.message;
  red_packet_info.name = event.params.name;
  red_packet_info.creation_time = event.params.creation_time.toI32();
  red_packet_info.save();  

  // create red packet
  let rpid = red_packet_info.rpid;
  let red_packet = new RedPacket(rpid);  
  red_packet.chain_id = CHAIN_ID;
  red_packet.contract_address = event.transaction.to!;
  red_packet.contract_version = 4
  red_packet.rpid = rpid;
  red_packet.txid = txHash;
  red_packet.password = "PASSWORD INVALID"; // a password was stored locally and kept by creator  
  red_packet.message = event.params.message;
  red_packet.name = event.params.name;
  red_packet.total = event.params.total;
  red_packet.total_remaining = event.params.total;
  red_packet.duration = event.params.duration.toI32();
  red_packet.shares = event.params.number.toI32();
  red_packet.is_random = event.params.ifrandom;
  red_packet.creation_time = red_packet_info.creation_time;
  red_packet.last_updated_time = red_packet_info.creation_time;
  red_packet.creator = creator.id;
  red_packet.claimers = [];
  red_packet.token = token.id;
  red_packet.save();  
}

export function handleClaimSuccess(event: ClaimSuccess): void {
  // the red packet id
  let rpid = event.params.id.toHexString();

  // create token
  let token = fetchToken(event.params.token_address);
  token.save();

  // create claimer
  let claimer_addr = event.params.claimer.toHexString();
  let claimer = Claimer.load(claimer_addr);
  if (claimer == null) {
    claimer = new Claimer(claimer_addr);
  }
  claimer.address = event.params.claimer;
  claimer.name = event.params.claimer.toHexString().slice(0, 6);
  claimer.save();

  // update pool
  let red_packet = RedPacket.load(rpid);
  if (red_packet == null) {
    return;
  }
  red_packet.last_updated_time = event.block.timestamp.toI32();
  red_packet.total_remaining = red_packet.total_remaining.minus(
    event.params.claimed_value
  );
  if (!red_packet.claimers.includes(claimer_addr)) {
    red_packet.claimers = red_packet.claimers.concat([claimer.id]);
  }
  red_packet.save();
}

export function handleRefundSuccess(event: RefundSuccess): void {
  let rpid = event.params.id.toHexString();
  let red_packet = RedPacket.load(rpid);
  if (red_packet == null) {
    return;
  }
  red_packet.total_remaining = BigInt.fromI32(0);
  red_packet.save();
}
