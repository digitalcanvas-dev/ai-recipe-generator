import type {
  KeyboardEvent,
  MouseEvent,
  CSSProperties,
  PropsWithChildren,
} from 'react';
import { useRef, useState } from 'react';
import type { ActionArgs, V2_MetaFunction } from '@remix-run/node';
import { Form, useActionData, useNavigation } from '@remix-run/react';
import type { CreateChatCompletionRequest } from 'openai';
import { Configuration, OpenAIApi } from 'openai';
import { IconLoader2, IconX } from '@tabler/icons-react';

const TITLE = 'EpicurAIn';

const DESC = 'Your personal AI Recipe Generator';

export const meta: V2_MetaFunction = () => [
  { title: TITLE },
  { name: 'description', content: DESC },
];

const COMMON_INGREDIENTS =
  'Salt, Pepper, Olive oil, Butter, All-purpose flour, Sugar, Eggs, Milk, Garlic, Onion, Lemons, White Vinegar, Apple Cider Vinegar, Soy sauce, Baking powder, Cumin';
const COMMON_EQUIPMENT = 'Stove top, Oven, Microwave';

const ROLE =
  "You are a trustworthy and experienced chef's assistant with an excellent grasp of cooking. You are also pragmatic and focus on dishes that are easy to assemble and use minimal ingredients.";

const generateRequest = ({
  ingredientsList,
  equipmentList,
  numAdults,
  numChildren,
  meal,
}: {
  ingredientsList: string;
  equipmentList: string;
  numAdults: number;
  numChildren: number;
  meal: string;
}) => {
  const peopleStrings = `${
    numAdults ? (numAdults > 1 ? numAdults + ' adults' : '1 adult') : ''
  }${numAdults && numChildren ? ' and ' : ''}${
    numChildren ? (numChildren > 1 ? numChildren + ' children' : '1 child') : ''
  }`;

  return `Try to create a recipe with only these available ingredients: ${ingredientsList}.
  And available equipment: ${equipmentList}.
  This is for a ${meal} for ${peopleStrings}.
  Not all ingredients or equipment need to be used. Do not assume I have other equipment or that I have any other ingredients.
  If there's no viable recipe, such as the ingredients list doesn't include any protein,
  do not assume I have other ingredients or equipment and tell me that there's no recipe.`;
};

export const action = async ({ request }: ActionArgs) => {
  const formData = await request.formData();

  const ingredientsList = `${formData.get('ingredientsList') ?? ''}`;
  const equipmentList = `${formData.get('equipmentList') ?? ''}`;

  const numAdults = +`${formData.get('numAdults') ?? 0}`;
  const numChildren = +`${formData.get('numChildren') ?? 0}`;

  const meal = `${formData.get('mealName') ?? 'dinner'}`;

  if (!ingredientsList || !equipmentList || numAdults + numChildren < 1) {
    return null;
  }

  // TODO: persist inputs in local storage.

  const params = {
    ingredientsList,
    equipmentList,
    numAdults,
    numChildren,
    meal,
  };

  const configuration = new Configuration({
    apiKey: process.env.OPENAI_API_KEY,
    organization: process.env.OPENAI_API_ORG,
  });

  const openai = new OpenAIApi(configuration);

  const aiRequest = generateRequest(params);

  if (process.env.NODE_ENV === 'development') {
    console.log(aiRequest);
  }

  const completionRequest: CreateChatCompletionRequest = {
    model: 'gpt-3.5-turbo',
    messages: [
      {
        role: 'system',
        content: ROLE,
      },
      { role: 'user', content: aiRequest },
    ],
  };

  try {
    const chatCompletion = await openai.createChatCompletion(completionRequest);

    return {
      generatedOutput: chatCompletion.data.choices[0].message?.content ?? '',
    };
  } catch (e) {
    console.error(JSON.stringify(e));
    return null;
  }
};

const inputClassName = `rounded-xl border border-teal-400 py-2 px-4 hover:border-teal-500 focus:outline-none focus-visible:ring`;

const checkboxClassName = `h-4 w-4 rounded-xl appearance-none border border-teal-400 p-2 hover:border-teal-500 focus:outline-none focus-visible:ring checked:bg-teal-400`;

const addButtonClassName = `self-stretch rounded-xl border border-teal-500 px-2 hover:bg-teal-200 focus:outline-none focus-visible:ring`;

const ulClassName = `space-y-1.5 text-sm [&>li]:grid [&>li]:grid-flow-col [&>li]:items-center [&>li]:justify-start [&>li]:gap-2`;

const h2ClassName = `text-lg font-bold`;

const generateButtonClassName = `mt-14 justify-self-start rounded-xl bg-teal-400 px-6 py-3 text-white disabled:cursor-not-allowed hover:bg-teal-600 disabled:opacity-80 hover:disabled:bg-teal-400 hover:disabled:text-white focus:outline-none focus-visible:ring`;

const FormRow = ({
  children,
  style,
}: PropsWithChildren<{ style?: CSSProperties }>) => {
  return (
    <div
      className="grid grid-cols-2 items-center gap-x-4 gap-y-2"
      style={style}
    >
      {children}
    </div>
  );
};

const ThingList = ({
  name,
  title,
  things,
  removeHandler,
}: {
  name: 'ingredientsList' | 'equipmentList';
  title: string;
  things: Set<string>;
  removeHandler: (toRm: string) => void;
}) => {
  return (
    <div>
      <h2 className={h2ClassName}>{title}</h2>
      <input
        className={inputClassName}
        type="hidden"
        name={name}
        value={[...things].join(', ')}
      />
      <ul className={ulClassName}>
        {things.size ? (
          [...things].map((thing) => (
            <li key={thing}>
              <IconX
                size="1rem"
                className="text-teal-900 hover:text-teal-500"
                onClick={() => removeHandler(thing)}
              />
              <span>{thing}</span>
            </li>
          ))
        ) : (
          <li>No {title.toLowerCase()} added</li>
        )}
      </ul>
    </div>
  );
};

export default function Index() {
  const [ingredients, setIngredients] = useState<Set<string>>(
    new Set(COMMON_INGREDIENTS.split(', '))
  );
  const [equipment, setEquipment] = useState<Set<string>>(
    new Set(COMMON_EQUIPMENT.split(', '))
  );

  const itemFieldRef = useRef<HTMLInputElement>(null);
  const equipFieldRef = useRef<HTMLInputElement>(null);

  const actionData = useActionData<{ generatedOutput: string }>();

  const generatedOutput = actionData?.generatedOutput ?? '';

  const navigation = useNavigation();

  const isThinking =
    navigation.state === 'loading' || navigation.state == 'submitting';

  const addThing = (
    type: 'ingredient' | 'equipment',
    inputEl: HTMLInputElement | null
  ) => {
    if (!inputEl) {
      return;
    }

    const setter = type === 'ingredient' ? setIngredients : setEquipment;

    const thing = inputEl.value;
    setter((currentItems) => {
      return !thing || currentItems.has(thing)
        ? currentItems
        : new Set([...currentItems, thing]);
    });

    inputEl['value'] = '';
    inputEl.focus();
  };

  const handleEnter =
    (type: 'ingredient' | 'equipment') => (e: KeyboardEvent) => {
      if (e.key !== 'Enter') {
        return;
      }
      // prevent submitting the entire form.
      e.stopPropagation();
      e.preventDefault();
      addThing(
        type,
        type === 'ingredient' ? itemFieldRef.current : equipFieldRef.current
      );
    };

  const handleClick =
    (type: 'ingredient' | 'equipment') =>
    (e: MouseEvent<HTMLButtonElement>) => {
      addThing(
        type,
        type === 'ingredient' ? itemFieldRef.current : equipFieldRef.current
      );
    };

  const handleToggleCommonThings =
    (type: 'ingredient' | 'equipment') => (e: MouseEvent<HTMLInputElement>) => {
      const things =
        type === 'ingredient' ? COMMON_INGREDIENTS : COMMON_EQUIPMENT;

      const setter = type === 'ingredient' ? setIngredients : setEquipment;

      const thingsArr = things.split(', ');

      if (e.currentTarget.checked) {
        setter((currentItems) => {
          return new Set([...currentItems, ...thingsArr]);
        });
      } else {
        setter((currentItems) => {
          const commonCopy = new Set([...currentItems]);

          thingsArr.forEach((item) => {
            commonCopy.delete(item);
          });

          return commonCopy;
        });
      }
    };

  const removeThing = (type: 'ingredient' | 'equipment', thing: string) => {
    const setter = type === 'ingredient' ? setIngredients : setEquipment;

    setter((currentThings) => {
      const copy = new Set([...currentThings]);
      copy.delete(thing);
      return copy;
    });
  };

  // about 150-line component returned; can be cleaned up and split into multiple components.
  return (
    <main className="p-20">
      <section className="mx-auto max-w-screen-md rounded-3xl border border-gray-200 bg-white px-14 py-10 text-gray-800">
        <h1 className="mb-4 font-serif text-2xl font-bold">
          {TITLE} - {DESC}
        </h1>
        <Form method="POST" className="grid grid-flow-row auto-rows-auto gap-6">
          <div className="grid grid-cols-1 items-start gap-4">
            <FormRow style={{ gridTemplateColumns: '2fr 1fr' }}>
              <span className="col-span-2">Add an ingredient:</span>
              <input
                className={inputClassName}
                type="text"
                name="newItem"
                placeholder="apple"
                ref={itemFieldRef}
                onKeyDown={handleEnter('ingredient')}
              />
              <button
                className={addButtonClassName}
                type="button"
                onClick={handleClick('ingredient')}
              >
                Add
              </button>
            </FormRow>
            <label>
              <FormRow
                style={{
                  gridTemplateColumns: 'auto 1fr',
                  justifyItems: 'start',
                }}
              >
                <span>Include common ingredients?</span>
                <input
                  defaultChecked
                  className={checkboxClassName}
                  type="checkbox"
                  onClick={handleToggleCommonThings('ingredient')}
                />
              </FormRow>
            </label>
            <FormRow style={{ gridTemplateColumns: '2fr 1fr' }}>
              <span className="col-span-2">Add kitchen equipment:</span>
              <input
                className={inputClassName}
                type="text"
                name="newEquipment"
                ref={equipFieldRef}
                placeholder="air fryer"
                onKeyDown={handleEnter('equipment')}
              />
              <button
                className={addButtonClassName}
                type="button"
                onClick={handleClick('equipment')}
              >
                Add
              </button>
            </FormRow>
            <label>
              <FormRow
                style={{
                  gridTemplateColumns: 'auto 1fr',
                  justifyItems: 'start',
                }}
              >
                <span>Include common equipment?</span>
                <input
                  defaultChecked
                  className={checkboxClassName}
                  type="checkbox"
                  onClick={handleToggleCommonThings('equipment')}
                />
              </FormRow>
            </label>
          </div>
          <div className="grid grid-flow-row auto-rows-auto gap-4">
            <FormRow>
              <label htmlFor="numAdults">Number of adults</label>
              <input
                className={inputClassName}
                type="number"
                name="numAdults"
                defaultValue={2}
                min={0}
              />
            </FormRow>
            <FormRow>
              <label htmlFor="numChildren">Number of kids</label>
              <input
                className={inputClassName}
                type="number"
                name="numChildren"
                defaultValue={0}
                min={0}
              />
            </FormRow>
            <FormRow>
              <label className="grid grid-cols-2" htmlFor="mealName">
                Meal
              </label>
              <select
                name="mealName"
                className={inputClassName}
                defaultValue="dinner"
              >
                <option value="breakfast">Breakfast</option>
                <option value="lunch">Lunch</option>
                <option value="dinner">Dinner</option>
                <option value="snack">Snack</option>
              </select>
            </FormRow>
          </div>
          <hr className="my-4 border-teal-500" />
          <summary className="grid grid-cols-2 gap-10">
            <ThingList
              name="ingredientsList"
              title="Ingredients"
              things={ingredients}
              removeHandler={(thing) => removeThing('ingredient', thing)}
            />
            <ThingList
              name="equipmentList"
              title="Equipment"
              things={equipment}
              removeHandler={(thing) => removeThing('equipment', thing)}
            />
          </summary>
          <button
            disabled={!ingredients.size || !equipment.size || isThinking}
            className={`${generateButtonClassName} ${
              isThinking ? 'opacity-50' : ''
            }`}
            type="submit"
          >
            {isThinking ? <IconLoader2 className="animate-spin" /> : 'Generate'}
          </button>
        </Form>
        <section>
          <pre
            className="mt-8"
            style={{
              // not fully supported, yet
              // @ts-ignore
              textWrap: 'balance',
            }}
          >
            {generatedOutput}
          </pre>
        </section>
      </section>
    </main>
  );
}
