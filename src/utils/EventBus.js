import Phaser from 'phaser';

class EventBusClass extends Phaser.Events.EventEmitter {
  constructor() {
    super();
  }
}

export const EventBus = new EventBusClass();
