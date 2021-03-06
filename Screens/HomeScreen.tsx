import React, { useEffect, useState, useRef } from 'react';
import { Text, StyleSheet, Dimensions, ToastAndroid, TouchableOpacity } from 'react-native';
import { PermissionsAndroid } from 'react-native';
import Modal from 'react-native-modal';
import * as MediaLibrary from 'expo-media-library';
import * as Sharing from 'expo-sharing';
import { connect } from 'react-redux';
import store from '../redux/store';
import ViewShot, { captureRef } from 'react-native-view-shot';
import moment from 'moment';
import * as Location from 'expo-location';
import * as TaskManager from 'expo-task-manager';
import Map from '../Components/Map';
import { isPointInPolygon } from 'geolib';
import Navbar from '../Components/Navbar';
import boroughs from '../assets/london_sport.json';
import { AppDispatch } from '../Models/Redux.model';
import BeerModal from '../Components/BeerModal';

import {
  storeBorough,
  storeLocation,
  updateAllUserStates,
  changeLoading,
  storeBeerFreqs,
  getBadges,
} from '../redux/actions';
import Topbar from '../Components/Topbar';
import { Borough } from '../Models/Borough.model';
import { Beer } from '../Models/Beer.model';
import { User } from '../Models/User.model';

const simpleArrayOfBoroughs: Borough[] = boroughs.features.map(borough => {
  return {
    boroughName: borough.properties.name,
    boroughId: borough.id,
    boroughCoords: borough.geometry.coordinates[0].map(coords => {
      return {
        latitude: coords[1],
        longitude: coords[0],
      };
    }),
  };
});

const HomeScreen = ({
  currentBorough,
  navigation,
  setAllUserStates,
  location,
  user,
  setLoading,
  setBeerFrequency,
  populateBadges,
}: any) => {
  const [lastBeer, setLastBeer] = useState({});
  useEffect(() => {
    setLoading(true);
    // Loading status cleared on the getLocations action to make sure the api calls
    // have ended before showing the screen.
    (async () => {
      await MediaLibrary.requestPermissionsAsync();
      let { status } = await Location.requestPermissionsAsync();

      if (status === 'granted') {
        await Location.startLocationUpdatesAsync('background-location-task', {
          accuracy: Location.Accuracy.Highest,
        });
      } else {
        console.info('Permission to access location was denied');
      }

      // Triggers a new listener that will check if the location is updated.
      // On update, background-location-task will manage the changes in the TaskManager.
    })();
    populateBadges();
  }, []);

  useEffect(() => {
    if (user.sub) {
      setAllUserStates(user);
    }
  }, [user.sub]);

  useEffect(() => {
    if (user.sub) {
      user.Locations.length !== 0
        ? setLastBeer(user.Locations[0])
        : setLastBeer({ beerName: 'Get a beer', createdAt: new Date(), boroughName: 'you!' });
    }
  }, [user.Locations]);

  useEffect(() => {
    let locs = [...user.Locations];
    if (locs.length !== 0) {
      let frequencies: { [key: string]: number } = locs.reduce((acc, cur) => {
        acc[cur.beerName] = (acc[cur.beerName] || 0) + 1;
        return acc;
      }, {});
      let sortedFreqs = Object.entries(frequencies).sort((a, b) => b[1] - a[1]);
      setBeerFrequency(sortedFreqs);
    }
  }, [user.Locations]);

  const screenShot = useRef();

  const takeScreenShot = async () => {
    try {
      await hasAndroidPermission();
      const uri = await captureRef(screenShot, {
        format: 'jpg',
        quality: 0.8,
      });
      ToastAndroid.showWithGravity(
        "Your map has been saved and it's ready to be shared 🍺",
        ToastAndroid.SHORT,
        ToastAndroid.TOP
      );
      await savePicture(uri);
      Sharing.shareAsync(uri);
    } catch (error) {
      console.log(error);
    }
  };

  const hasAndroidPermission = async () => {
    const permission = await PermissionsAndroid.PERMISSIONS.WRITE_EXTERNAL_STORAGE;
    const hasPermission = await PermissionsAndroid.check(permission);
    if (hasPermission) {
      const status = await PermissionsAndroid.request(permission);
      status === 'granted' ? null : console.log('Permission to store DENIED');
    }
  };

  const savePicture = async (uri: string) => {
    try {
      const { granted } = await MediaLibrary.getPermissionsAsync();
      granted
        ? await MediaLibrary.saveToLibraryAsync(uri)
        : console.log('problems while saving screenshot');
    } catch (e) {
      console.log('Error in catch - savePicture', e);
    }
  };
  const [showBeerModalInfo, setShowBeerModalInfo] = useState(false);
  const handlePress = () => {
    setShowBeerModalInfo(!showBeerModalInfo);
  };

  const getLastBeer = (beerId: number): Beer => {
    return user.drunkBeers.filter(b => b.beerId === beerId)[0];
  };

  return (
    <ViewShot ref={screenShot} style={styles.homeScreen}>
      <Topbar navigation={navigation} user={user} currentBorough={currentBorough} />
      <Map
        boroughs={simpleArrayOfBoroughs}
        boroughCounter={user.boroughCounter}
        location={location}
        user={user}
      />
      <TouchableOpacity style={styles.lastBeer} onPress={() => handlePress()}>
        {user.Locations.lengtgh !== 0 ? (
          <Text style={{ opacity: 0.6 }}>Your last beer was a :</Text>
        ) : null}
        <Text style={styles.lastBeerName}>
          {lastBeer.beerName} in {lastBeer.boroughName}
        </Text>
        <Text style={styles.lastBeerDate}>
          {moment(lastBeer.createdAt).format('dddd, MMM Do YYYY')}
        </Text>
      </TouchableOpacity>
      <Navbar
        takeScreenShot={takeScreenShot}
        lastBeer={lastBeer}
        boroughs={simpleArrayOfBoroughs}
        navigation={navigation}
      />
      {showBeerModalInfo && (
        <Modal
          style={{
            justifyContent: 'center',
            backgroundColor: '#000000aa',
            margin: 0,
            flex: 1,
            padding: 15,
          }}
          transparent={true}
          visible={true}
          statusBarTranslucent={true}
          onBackdropPress={() => setShowBeerModalInfo(false)}
        >
          <BeerModal beer={getLastBeer(lastBeer.beerId)} />
        </Modal>
      )}
    </ViewShot>
  );
};

TaskManager.defineTask('background-location-task', ({ data, error }) => {
  if (error) {
    console.log('error in taskManager');
  }
  if (data) {
    const { latitude, longitude } = data.locations[0].coords;
    store.dispatch(storeLocation({ latitude, longitude }));
    simpleArrayOfBoroughs.some(
      borough =>
        isPointInPolygon({ latitude, longitude }, borough.boroughCoords) &&
        store.dispatch(storeBorough(borough))
    );
  }
});

function mapStateToProps(state: any) {
  return {
    currentBorough: state.currentBorough,
    user: state.user,
    location: state.location,
    beerFrequency: state.user.beerFreqs,
  };
}

function mapDispatch(dispatch: AppDispatch) {
  return {
    setAllUserStates: (user: User) => dispatch(updateAllUserStates(user)),
    setLoading: (status: boolean) => dispatch(changeLoading(status)),
    setBeerFrequency: (freqs: [[]]) => dispatch(storeBeerFreqs(freqs)),
    populateBadges: () => dispatch(getBadges()),
  };
}

export default connect(mapStateToProps, mapDispatch)(HomeScreen);

const styles = StyleSheet.create({
  homeScreen: {
    flex: 1,
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    height: Dimensions.get('screen').height,
  },
  lastBeer: {
    flex: 1,
    backgroundColor: '#ffd700',
    borderWidth: 2,
    width: 300,
    borderColor: 'whitesmoke',
    borderRadius: 4,
    position: 'absolute',
    bottom: 100,
    left: '50%',
    marginLeft: -150,
    elevation: 22,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 12,
  },
  lastBeerName: {
    fontSize: 25,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  lastBeerDate: {
    fontSize: 15,
    marginTop: 5,
  },
  map: {
    width: '100%',
    height: '50%',
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 8,
    height: 'auto',
    paddingHorizontal: 10,
    backgroundColor: 'gold',
    elevation: 10,
    width: '100%',
  },
  currentView: {
    width: 'auto',
    height: 25,
    justifyContent: 'center',
  },
  currentBoroughName: {
    fontSize: 25,
    marginLeft: 10,
  },
  previewImage: {
    height: 200,
    backgroundColor: 'black',
  },
  title: {
    opacity: 0.6,
    fontSize: 20,
    position: 'absolute',
    width: Dimensions.get('screen').width,
    textAlign: 'center',
  },
});
