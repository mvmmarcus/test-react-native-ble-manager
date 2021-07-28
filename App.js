/**
 * Sample React Native App
 * https://github.com/facebook/react-native
 *
 * @format
 * @flow strict-local
 */

import React, {useEffect, useState} from 'react';
import {
  NativeModules,
  NativeEventEmitter,
  SafeAreaView,
  StatusBar,
  StyleSheet,
  Text,
  Button,
  View,
  Platform,
  PermissionsAndroid,
  FlatList,
  TouchableHighlight,
} from 'react-native';

// import and setup react-native-ble-manager
import BleManager from 'react-native-ble-manager';
const BleManagerModule = NativeModules.BleManager;
const bleEmitter = new NativeEventEmitter(BleManagerModule);

// import stringToBytes from convert-string package.
// this func is useful for making string-to-bytes conversion easier
import {bytesToString, stringToBytes} from 'convert-string';

// import Buffer function.
// this func is useful for making bytes-to-string conversion easier
import Buffer from 'buffer';

import {Colors} from 'react-native/Libraries/NewAppScreen';

const App = () => {
  const [isScanning, setIsScanning] = useState(false);
  const peripherals = new Map();
  const [list, setList] = useState([]);

  const [peripheralId, setPeripheralId] = useState('');
  const [service, setService] = useState('');
  const [charasteristic, setCharasteristic] = useState('');

  // start to scan peripherals
  const startScan = () => {
    // skip if scan process is currenly happening
    if (isScanning) {
      return;
    }

    // first, clear existing peripherals
    peripherals.clear();
    setList(Array.from(peripherals.values()));

    // then re-scan it
    BleManager.scan([], 3, true)
      .then(() => {
        console.log('Scanning...');
        setIsScanning(true);
      })
      .catch(err => {
        console.error(err);
      });
  };

  // handle discovered peripheral
  const handleDiscoverPeripheral = peripheral => {
    console.log('Got ble peripheral', peripheral);

    if (!peripheral.name) {
      peripheral.name = 'NO NAME';
    }

    peripherals.set(peripheral.id, peripheral);
    setList(Array.from(peripherals.values()));
  };

  // handle stop scan event
  const handleStopScan = () => {
    console.log('Scan is stopped');
    setIsScanning(false);
  };

  // handle disconnected peripheral
  // const handleDisconnectedPeripheral = data => {
  //   console.log('tentou desconectar');
  //   // console.log('Disconnected from ' + data.peripheral);

  //   // let peripheral = peripherals.get(data.peripheral);
  //   // if (peripheral) {
  //   //   peripheral.connected = false;
  //   //   peripherals.set(peripheral.id, peripheral);
  //   //   setList(Array.from(peripherals.values()));
  //   // }
  // };

  // update stored peripherals
  const updatePeripheral = (peripheral, callback) => {
    let p = peripherals.get(peripheral.id);
    if (!p) {
      return;
    }

    p = callback(p);
    peripherals.set(peripheral.id, p);
    setList(Array.from(peripherals.values()));
  };

  // get advertised peripheral local name (if exists). default to peripheral name
  const getPeripheralName = item => {
    if (item.advertising) {
      if (item.advertising.localName) {
        return item.advertising.localName;
      }
    }

    return item.name;
  };

  const writeRequest = (id, serviceUUID, charasteristicUUID, payload) => {
    console.log('###### WRITE ####');

    const payloadBytes = stringToBytes(payload);
    console.log({payloadBytes});

    BleManager.write(id, serviceUUID, charasteristicUUID, payloadBytes)
      .then(res => {
        console.log('write response', res);
        // alert(`your "${payload}" is stored to the food bank. Thank you!`);
      })
      .catch(error => {
        console.log('write err', error);
      });
  };

  const startNotification = (id, serviceUUID, charasteristicUUID) => {
    console.log('NOTIFICATION');
    console.log('Notification id: ', id);
    console.log('Notification serviceUUID: ', serviceUUID);
    console.log('Notification charasteristicUUID: ', charasteristicUUID);

    return BleManager.startNotification(
      id,
      serviceUUID,
      charasteristicUUID,
    ).then(res => {
      console.log('start notification response', res);
    });
  };

  const readGlucose = (id, serviceUUID, charasteristicUUID) => {
    BleManager.read(id, serviceUUID, charasteristicUUID)
      .then(res => {
        console.log('read response', res); // [229, 7, 7, 27, 12, 19, 0]
        if (res) {
          // const buffer = Buffer.from(res);
          // const data = buffer.toString();
          // console.log('data', data); // �♀‼

          const newBuffer = Buffer.Buffer.from(res);
          const sensorData = newBuffer.readInt16LE();
          console.log('sensorData: ', sensorData);
          console.log('newBuffer: ', newBuffer);
        }
      })
      .catch(error => {
        console.log('read err', error);
      });
  };

  // connect to peripheral then test the communication
  const connectAndTestPeripheral = peripheral => {
    console.log({peripheral});

    if (!peripheral) {
      return;
    }

    if (peripheral.connected) {
      BleManager.disconnect(peripheral.id);
      return;
    }

    console.log('vai tentar criar o bond');

    BleManager.createBond(peripheral.id)
      .then(() => {
        console.log('createBond success or there is already an existing one');

        console.log('vai tentar conectar');
        // connect to selected peripheral
        BleManager.connect(peripheral.id)
          .then(() => {
            console.log('Connected to ' + peripheral.id, peripheral);

            // update connected attribute
            updatePeripheral(peripheral, p => {
              p.connected = true;
              return p;
            });

            // retrieve peripheral services info
            BleManager.retrieveServices(peripheral.id).then(peripheralInfo => {
              console.log('Retrieved peripheral services', peripheralInfo);

              // test read current peripheral RSSI value
              BleManager.readRSSI(peripheral.id).then(rssi => {
                console.log('Retrieved actual RSSI value', rssi);

                // update rssi value
                updatePeripheral(peripheral, p => {
                  p.rssi = rssi;
                  return p;
                });
              });

              // test read and write data to peripheral
              const serviceUUID = '1808';
              const charasteristicUUID = '2A18';

              setPeripheralId(peripheral.id);
              setService(serviceUUID);
              setCharasteristic(charasteristicUUID);

              setTimeout(() => {
                startNotification(
                  peripheral.id,
                  serviceUUID,
                  '00002a34-0000-1000-8000-00805f9b34fb',
                ).then(() => {
                  setTimeout(() => {
                    startNotification(
                      peripheral.id,
                      serviceUUID,
                      '00002a18-0000-1000-8000-00805f9b34fb',
                    );
                  }, 500);
                });
              }, 500);
            });
          })
          .catch(error => {
            console.log('Connection error', error);
          });
      })
      .catch(() => {
        console.log('fail to bond');
      });
  };

  // mount and onmount event handler
  useEffect(() => {
    console.log('Mount');

    // initialize BLE modules
    BleManager.start({showAlert: false}).then(() =>
      console.log('Successfull Initialization'),
    );

    // add ble listeners on mount
    bleEmitter.addListener(
      'BleManagerDiscoverPeripheral',
      handleDiscoverPeripheral,
    );
    bleEmitter.addListener('BleManagerStopScan', handleStopScan);
    // bleEmitter.addListener(
    //   'BleManagerDisconnectPeripheral',
    // //   handleDisconnectedPeripheral,
    // );

    bleEmitter.addListener('BleManagerDidUpdateState', args => {
      console.log('######## BleManagerDidUpdateState ########');
      console.log('args: ', args);
      console.log('The new state:', args.state);
    });

    bleEmitter.addListener(
      'BleManagerDidUpdateValueForCharacteristic',
      ({value, peripheral, characteristic, service}) => {
        // Convert bytes array to string
        console.log('value: ', value);
        const data = bytesToString(value);
        console.log(`Recieved ${data} for characteristic ${characteristic}`);
      },
    );

    // check location permission only for android device
    if (Platform.OS === 'android' && Platform.Version >= 23) {
      PermissionsAndroid.check(
        PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
      ).then(r1 => {
        if (r1) {
          console.log('Permission is OK');
          return;
        }

        PermissionsAndroid.request(
          PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
        ).then(r2 => {
          if (r2) {
            console.log('User accept');
            return;
          }

          console.log('User refuse');
        });
      });
    }

    // remove ble listeners on unmount
    return () => {
      console.log('Unmount');

      bleEmitter.removeListener(
        'BleManagerDiscoverPeripheral',
        handleDiscoverPeripheral,
      );
      bleEmitter.removeListener('BleManagerStopScan', handleStopScan);
      // bleEmitter.removeListener(
      //   'BleManagerDisconnectPeripheral',
      // //   handleDisconnectedPeripheral,
      // );

      bleEmitter.removeListener('BleManagerDidUpdateState', args => {});

      bleEmitter.addListener(
        'BleManagerDidUpdateValueForCharacteristic',
        () => {},
      );
    };
  }, []);

  // render list of devices
  const renderItem = item => {
    if (item?.name !== 'NO NAME') {
      console.log({item});
    }

    const color = item.connected ? 'green' : '#fff';
    return (
      <TouchableHighlight onPress={() => connectAndTestPeripheral(item)}>
        <View style={[styles.row, {backgroundColor: color}]}>
          <Text
            style={{
              fontSize: 12,
              textAlign: 'center',
              color: '#333333',
              padding: 10,
            }}>
            {getPeripheralName(item)}
          </Text>
          <Text
            style={{
              fontSize: 10,
              textAlign: 'center',
              color: '#333333',
              padding: 2,
            }}>
            RSSI: {item.rssi}
          </Text>
          <Text
            style={{
              fontSize: 8,
              textAlign: 'center',
              color: '#333333',
              padding: 2,
              paddingBottom: 20,
            }}>
            {item.id}
          </Text>
        </View>
      </TouchableHighlight>
    );
  };

  return (
    <>
      <StatusBar barStyle="dark-content" />
      <SafeAreaView style={styles.safeAreaView}>
        {/* header */}
        <View style={styles.body}>
          <View style={styles.scanButton}>
            <Button
              title={'Scan Bluetooth Devices'}
              onPress={() => startScan()}
            />
          </View>

          {list.length === 0 && (
            <View style={styles.noPeripherals}>
              <Text style={styles.noPeripheralsText}>No peripherals</Text>
            </View>
          )}
        </View>

        {/* ble devices */}
        <FlatList
          data={list}
          renderItem={({item}) => renderItem(item)}
          keyExtractor={item => item.id}
        />

        {/* bottom footer */}
        <View style={styles.footer}>
          <TouchableHighlight
            onPress={() => startNotification(peripheralId, '1808', '2A18')}>
            <View style={[styles.row, styles.footerButton]}>
              <Text>Glucose M. Notify</Text>
            </View>
          </TouchableHighlight>
          <TouchableHighlight
            onPress={() => readGlucose(peripheralId, '1808', '2A51')}>
            <View style={[styles.row, styles.footerButton]}>
              <Text>Read Glucose Feature</Text>
            </View>
          </TouchableHighlight>
          <TouchableHighlight
            onPress={() =>
              readGlucose(
                peripheralId,
                '1808',
                '00002a08-0000-1000-8000-00805f9b34fb',
              )
            }>
            <View style={[styles.row, styles.footerButton]}>
              <Text>Read Date</Text>
            </View>
          </TouchableHighlight>
        </View>
        <View style={styles.footer}>
          <TouchableHighlight
            onPress={() => startNotification(peripheralId, '1808', '2A34')}>
            <View style={[styles.row, styles.footerButton]}>
              <Text>Glucose M. Ctx Notify</Text>
            </View>
          </TouchableHighlight>
          <TouchableHighlight
            onPress={() => startNotification(peripheralId, '1808', '2A52')}>
            <View style={[styles.row, styles.footerButton]}>
              <Text>RACP Notify</Text>
            </View>
          </TouchableHighlight>
          <TouchableHighlight
            onPress={() =>
              writeRequest(peripheralId, service, '2A52', '0x0101')
            }>
            <View style={[styles.row, styles.footerButton]}>
              <Text>Write R. A. Control Point</Text>
            </View>
          </TouchableHighlight>
        </View>
      </SafeAreaView>
    </>
  );
};

const styles = StyleSheet.create({
  safeAreaView: {
    flex: 1,
  },
  body: {
    backgroundColor: Colors.white,
  },
  scanButton: {
    margin: 10,
  },
  noPeripherals: {
    flex: 1,
    margin: 20,
  },
  noPeripheralsText: {
    textAlign: 'center',
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    width: '100%',
    marginBottom: 30,
  },
  footerButton: {
    alignSelf: 'stretch',
    padding: 10,
    backgroundColor: 'grey',
  },
});

export default App;
