import { Address, BigInt, Bytes } from "@graphprotocol/graph-ts";
import { fetchToken } from "./helpers";
import {
  ClaimSuccess,
  CreationSuccess,
  RefundSuccess,
  Create_red_packetCall,
} from "../generated/RedPacketV2/RedPacketV2";
import {
  Claimer,
  Creator,
  RedPacket,
  RedPacketInfo,
} from "../generated/schema";
import {
  CHAIN_ID,
  ETH_ADDR,
  TOKEN_TYPE_ETHER,
} from "./constants";

export function handleCreateRedPacket(call: Create_red_packetCall): void {
  let txHash = call.transaction.hash.toHexString();
  let red_packet_info = RedPacketInfo.load(txHash);

  // the event handler will be called before call handler
  // if a map record cannot be found than we skip the call
  if (!red_packet_info) return;

  // create creator
  let creator_addr = call.from.toHexString();
  let creator = Creator.load(creator_addr);
  if (creator == null) {
    creator = new Creator(creator_addr);
  }
  creator.address = call.from;
  creator.name = call.inputs._name;
  creator.save();

  // create token
  let token = fetchToken(
    call.inputs._token_type.toI32() === TOKEN_TYPE_ETHER
      ? (Bytes.fromHexString(ETH_ADDR) as Address)
      : call.inputs._token_addr
  );
  token.save();

  // create red packet
  let rpid = red_packet_info.rpid;
  let red_packet = new RedPacket(rpid);
  red_packet.chain_id = CHAIN_ID;
  red_packet.contract_address = call.to;
  red_packet.contract_version = 2;
  red_packet.rpid = rpid;
  red_packet.txid = txHash;
  red_packet.password = "PASSWORD INVALID"; // a password was stored locally and kept by creator
  red_packet.message = call.inputs._message;
  red_packet.name = call.inputs._name;
  red_packet.total = call.inputs._total_tokens;
  red_packet.total_remaining = call.inputs._total_tokens;
  red_packet.duration = call.inputs._duration.toI32();
  red_packet.shares = call.inputs._number.toI32();
  red_packet.is_random = call.inputs._ifrandom;
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

export function handleCreationSuccess(event: CreationSuccess): void {
  let txHash = event.transaction.hash.toHexString();

  // the event handlers will be triggered before call handlers in the same transaction
  // this event handler only stores the necessary pool info into a map
  // the creation of the pool happens when the call handler was triggered
  let red_packet_info = new RedPacketInfo(txHash);
  red_packet_info.rpid = event.params.id.toHexString();
  red_packet_info.message = event.params.message;
  red_packet_info.name = event.params.name;
  red_packet_info.creation_time = event.params.creation_time.toI32();
  red_packet_info.save();
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
