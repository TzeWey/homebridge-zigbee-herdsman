import ZclTransactionSequenceNumber from 'zigbee-herdsman/dist/controller/helpers/zclTransactionSequenceNumber';

/**
 * Workaround to get the next transaction sequence number that will
 * be used to by the ZigBee stack.
 */
function peekNextTransactionSequenceNumber() {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const current = (<any>ZclTransactionSequenceNumber).number as number;
  const next = current + 1;
  return next > 255 ? 1 : next;
}

export { peekNextTransactionSequenceNumber };
