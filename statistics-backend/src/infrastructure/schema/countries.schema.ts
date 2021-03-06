import { Prop, raw, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';
import { CountriesGeoDataObject } from '../../domain/model/countries-geo-data-object';

export type CountriesDocument = Countries & Document;

@Schema()
export class Countries {
  @Prop()
  key: string;
  @Prop(
    raw({
      countries: {
        type: { type: String },
        geometries: { type: Array },
      },
    }),
  )
  objects: CountriesGeoDataObject;
  @Prop()
  arcs: Array<Array<number>>;
  @Prop()
  amountOfCountries: number;
  @Prop()
  bbox: Array<number>;
  @Prop()
  type: 'Topology';
}

export const CountriesSchema = SchemaFactory.createForClass(Countries).set(
  'collection',
  'countries',
);
