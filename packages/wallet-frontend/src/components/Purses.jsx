import React from 'react';

import { makeStyles } from '@material-ui/core/styles';
import {
  List,
  ListItemIcon,
  ListItem,
  ListItemText,
  Typography,
} from '@material-ui/core';
import PurseIcon from '@material-ui/icons/BusinessCenter';

import { useApplicationContext } from '../contexts/Application';

const noOp = () => {};
const slotToDisplay = slot => slot;
// const { unserialize: display } = makeMarshal(noOp, slotToDisplay);
const display = () => {};

const displayExtent = amount => {
  const { brand, extent } = display(amount);
  // TODO: this check should be in boardID terms
  if (brand.petname === 'zoe invite') {
    return `${extent} ${brand.petname}`;
  }
  return `${JSON.stringify(extent)} ${brand.petname}`;
};

const useStyles = makeStyles(theme => ({
  icon: {
    minWidth: 24,
    marginRight: theme.spacing(2),
  },
}));

export default function Purses() {
  const classes = useStyles();
  const { state } = useApplicationContext();
  const { purses } = state;

  return (
    <>
      <Typography variant="h6">Purses</Typography>
      {Array.isArray(purses) && purses.length > 0 ? (
        <List>
          {purses.map(
            ({
              pursePetname,
              issuerPetname,
              extent,
              currentAmount,
            }) => (
              <ListItem key={pursePetname} value={pursePetname} divider>
                <ListItemIcon className={classes.icon}>
                  <PurseIcon />
                </ListItemIcon>
                <ListItemText
                  primary={pursePetname}
                  secondary={(
                    <>
                      <b>
                        {JSON.stringify(extent)} 
{' '}
{issuerPetname}
                      </b>
{' '}
                    </>
                  )}
                />
              </ListItem>
            ),
          )}
        </List>
      ) : (
        <Typography color="inherit">No purses.</Typography>
      )}
    </>
  );
}
