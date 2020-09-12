'use strict';

const {Gtk, GObject} = imports.gi;


const PrefsWidget = GObject.registerClass(
  class PrefsWidget extends Gtk.Box {
    _init(params) {
      super._init(params);

      this.margin = 20;
      this.set_spacing(15);
      this.set_orientation(Gtk.Orientation.VERTICAL);

      const label = new Gtk.Label({
        label: "Stocks Ticker Settings"
      })
      const spinButton = new Gtk.SpinButton();
      spinButton.set_sensitive(true);
      spinButton.set_range(-60, 60);
      spinButton.set_value(0);
      spinButton.set_increments(1, 2);
      spinButton.connect('value-changed', (w) => {
          log(w.get_value_as_int());
      });

      const hBox = new Gtk.Box();
      hBox.set_orientation(Gtk.Orientation.HORIZONTAL);
      hBox.pack_start(label, false, false, 0);
      hBox.pack_end(spinButton, false, false, 0);

      this.add(hBox);
    }
  }
);

function init() {}

function buildPrefsWidget() {
  const widget = new PrefsWidget();
  widget.show_all();
  return widget;
}
