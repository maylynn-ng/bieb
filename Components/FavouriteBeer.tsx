import React, { useState, useEffect } from 'react';
import { Image, TouchableOpacity, ToastAndroid, StyleSheet } from 'react-native';
import { connect } from 'react-redux';
import { updateFavourites } from '../redux/actions';
import { DB_LOCALHOST } from '../redux/actions';
import { AppDispatch, Action } from '../Models/Redux.model';
import { State } from '../redux/reducers';

const FavouriteBeer = ({
  beerId,
  favouriteBeers,
  UserId,
  setFavBeers,
}: {
  beerId: string;
  favouriteBeers: Set<Object>;
  UserId: number;
  setFavBeers: (favBeers: Set<Object>) => Action;
}): JSX.Element => {
  const [isFav, setIsFav] = useState(false);

  useEffect(() => {
    favouriteBeers.has(beerId) && setIsFav(true);
  }, [beerId]);

  const handlePress = () => {
    const newFavBeers = new Set(favouriteBeers);
    const oldFav = isFav;
    if (isFav) {
      newFavBeers.delete(beerId);
    } else {
      newFavBeers.add(beerId);
    }
    setIsFav(!isFav);
    fetch(`${DB_LOCALHOST}/favourites`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ UserId, favouriteBeers: Array.from(newFavBeers) }),
    })
      .then(res => {
        if (res.status >= 400) throw new Error("DB didn't store favourite");
        setFavBeers(newFavBeers);
      })
      .catch(err => {
        ToastAndroid.show("Couldn't save your favourite 😢", ToastAndroid.SHORT);
        setIsFav(oldFav);
      });
  };

  return (
    <TouchableOpacity style={styles.favIcon} onPress={handlePress}>
      <Image
        style={styles.favIcon}
        source={isFav ? require('../assets/fav-full.png') : require('../assets/fav-empty.png')}
      />
    </TouchableOpacity>
  );
};

function addStateToProps(state: State) {
  return {
    favouriteBeers: state.user.favouriteBeers,
    UserId: state.user.id,
  };
}

function mapDispatch(dispatch: AppDispatch) {
  return {
    setFavBeers: (favBeers: Set<Object>) => dispatch(updateFavourites(favBeers)),
  };
}

export default connect(addStateToProps, mapDispatch)(FavouriteBeer);

const styles = StyleSheet.create({
  favIcon: {
    width: 30,
    height: 30,
  },
});
